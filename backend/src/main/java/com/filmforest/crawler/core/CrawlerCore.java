package com.filmforest.crawler.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.filmforest.content.entity.*;
import com.filmforest.content.service.*;
import com.filmforest.crawler.entity.CrawlerSchedule;
import com.filmforest.crawler.entity.CrawlerTaskLog;
import com.filmforest.crawler.mapper.CrawlerTaskLogMapper;
import com.filmforest.crawler.service.CrawlerScheduleService;
import com.filmforest.resource.entity.ResourceMagnet;
import com.filmforest.resource.entity.ResourceOnline;
import com.filmforest.resource.entity.ResourceCloud;
import com.filmforest.resource.mapper.ResourceMagnetMapper;
import com.filmforest.resource.mapper.ResourceOnlineMapper;
import com.filmforest.resource.mapper.ResourceCloudMapper;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class CrawlerCore {

    private static final String BASE_URL = "https://www.pkmp4.xyz";
    private static final int TIMEOUT_MS = 15000;
    private static final int RETRY_TIMES = 2;

    @Autowired private MovieService movieService;
    @Autowired private DramaService dramaService;
    @Autowired private VarietyService varietyService;
    @Autowired private AnimeService animeService;
    @Autowired private ShortDramaService shortDramaService;
    @Autowired private CrawlerScheduleService scheduleService;
    @Autowired private CrawlerTaskLogMapper taskLogMapper;
    @Autowired private ResourceMagnetMapper magnetMapper;
    @Autowired private ResourceOnlineMapper onlineMapper;
    @Autowired private ResourceCloudMapper cloudMapper;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Pattern YEAR_PATTERN = Pattern.compile("((?:19|20)\\d{2})");
    private final Pattern ID_PATTERN = Pattern.compile("/mv/(\\d+)");

    // ========== Async Entry Point ==========

    @Async
    @Transactional
    public void executeCrawl(Long scheduleId, Long logId) {
        CrawlerSchedule schedule = scheduleService.getSchedule(scheduleId);
        CrawlerTaskLog taskLog = taskLogMapper.selectById(logId);
        if (schedule == null || taskLog == null) return;

        try {
            int added = 0, updated = 0, total = 0;
            String type = schedule.getContentType();
            int batchSize = schedule.getBatchSize() != null ? schedule.getBatchSize() : 20;

            if ("movie".equals(type)) {
                int[] r = crawlMovieList(1, batchSize);
                added = r[0]; updated = r[1]; total = r[2];
            } else if ("drama".equals(type)) {
                int[] r = crawlDramaList(1, batchSize);
                added = r[0]; updated = r[1]; total = r[2];
            } else if ("variety".equals(type)) {
                int[] r = crawlVarietyList(1, batchSize);
                added = r[0]; updated = r[1]; total = r[2];
            } else if ("anime".equals(type)) {
                int[] r = crawlAnimeList(1, batchSize);
                added = r[0]; updated = r[1]; total = r[2];
            } else if ("short_drama".equals(type)) {
                int[] r = crawlShortDramaList(1, batchSize);
                added = r[0]; updated = r[1]; total = r[2];
            }

            taskLog.setItemsCrawled(total);
            taskLog.setItemsAdded(added);
            taskLog.setItemsUpdated(updated);
            taskLog.setStatus("success");
            taskLog.setDurationMs((int) java.time.Duration.between(taskLog.getStartedAt(), LocalDateTime.now()).toMillis());
            taskLog.setFinishedAt(LocalDateTime.now());
            taskLogMapper.updateById(taskLog);

            schedule.setStatus("idle");
            schedule.setLastRunTime(LocalDateTime.now());
            schedule.setTotalRuns(schedule.getTotalRuns() + 1);
            schedule.setTotalItems(schedule.getTotalItems() + total);
            scheduleService.saveSchedule(schedule);

        } catch (Exception e) {
            log.error("Crawl error scheduleId={}", scheduleId, e);
            taskLog.setStatus("failed");
            taskLog.setErrorMessage(e.getMessage());
            taskLog.setFinishedAt(LocalDateTime.now());
            taskLogMapper.updateById(taskLog);

            CrawlerSchedule s2 = scheduleService.getSchedule(scheduleId);
            if (s2 != null) {
                s2.setStatus("idle");
                scheduleService.saveSchedule(s2);
            }
        }
    }

    // ========== Movie Crawler ==========

    // 七味网真实 URL 规则
    // 类型页: /vt/{type}.html (1=电影,2=剧集,3=综艺,4=动漫,30=短剧)
    // 分页: /vt/{type}-{page}.html
    // 详情页: /mv/{id}.html

    private String getListUrl(String type, int page) {
        return BASE_URL + "/vt/" + type + (page > 1 ? "-" + page : "") + ".html";
    }

    public int[] crawlMovieList(int startPage, int maxItems) {
        int added = 0, updated = 0, total = 0;
        int page = startPage;

        while (total < maxItems) {
            // type=1 电影列表: /vt/1.html, /vt/1-2.html, ...
            String listUrl = getListUrl("1", page);
            Document listDoc = fetchWithRetry(listUrl);
            if (listDoc == null) break;

            // 抓详情页链接 /mv/数字.html
            Elements links = listDoc.select("a[href^='/mv/']");
            if (links.isEmpty()) break;

            for (Element link : links) {
                if (total >= maxItems) break;
                String href = link.attr("href");
                if (!href.matches("/mv/\\d+\\.html")) continue;
                String detailUrl = BASE_URL + href;
                int[] r = crawlMovieDetail(detailUrl);
                if (r[0] == 1) added++;
                if (r[1] == 1) updated++;
                total++;
            }
            page++;
        }
        return new int[]{added, updated, total};
    }

    public int[] crawlMovieDetail(String detailUrl) {
        Document doc = fetchWithRetry(detailUrl);
        if (doc == null) return new int[]{0, 0, 0};

        try {
            String title = doc.selectFirst("h1").text().trim();
            if (title.isEmpty()) {
                log.warn("Empty title for {}, skipping", detailUrl);
                return new int[]{0, 0, 0};
            }

            String posterUrl = null;
            Element img = doc.selectFirst("div.li-img img, .movie-cover img");
            if (img != null) posterUrl = img.attr("abs:src");
            if (posterUrl == null) {
                Element ogImg = doc.selectFirst("meta[property=og:image]");
                if (ogImg != null) posterUrl = ogImg.attr("content");
            }

            Integer year = extractYear(doc);
            String storyline = extractStoryline(doc);
            String actor = parseTextField(doc, ".actor");
            String director = parseTextField(doc, ".director");
            String genre = parseTextField(doc, ".type, .tag");
            String region = parseTextField(doc, ".area");
            BigDecimal score = extractScore(doc);

            Long contentId = extractContentId(detailUrl);
            Movie existing = movieService.getById(contentId);
            boolean isNew = (existing == null);

            Movie movie = new Movie();
            movie.setTitle(title);
            movie.setPosterUrl(posterUrl);
            movie.setYear(year);
            movie.setStoryline(storyline);
            movie.setActor(toJsonArray(actor));
            movie.setDirector(toJsonArray(director));
            movie.setGenre(toJsonArray(genre));
            movie.setRegion(toJsonArray(region));
            movie.setScoreDouban(score);
            movie.setStatus(1);

            movieService.save(movie);
            Long dbId = movie.getId();
            extractMovieResources(doc, "movie", dbId);

            return new int[]{isNew ? 1 : 0, isNew ? 0 : 1, 0};
        } catch (Exception e) {
            log.error("Movie detail parse error: {} - {}", detailUrl, e.getMessage());
            return new int[]{0, 0, 0};
        }
    }

    // ========== Drama Crawler ==========

    // type=2 剧集列表: /vt/2.html, /vt/2-2.html
    public int[] crawlDramaList(int startPage, int maxItems) {
        int added = 0, updated = 0, total = 0;
        int page = startPage;

        while (total < maxItems) {
            String listUrl = getListUrl("2", page);
            Document listDoc = fetchWithRetry(listUrl);
            if (listDoc == null) break;

            Elements links = listDoc.select("a[href^='/mv/']");
            if (links.isEmpty()) break;

            for (Element link : links) {
                if (total >= maxItems) break;
                String href = link.attr("href");
                if (!href.matches("/mv/\\d+\\.html")) continue;
                String detailUrl = BASE_URL + href;
                int[] r = crawlDramaDetail(detailUrl);
                if (r[0] == 1) added++;
                if (r[1] == 1) updated++;
                total++;
            }
            page++;
        }
        return new int[]{added, updated, total};
    }

    public int[] crawlDramaDetail(String detailUrl) {
        Document doc = fetchWithRetry(detailUrl);
        if (doc == null) return new int[]{0, 0, 0};

        try {
            String title = doc.selectFirst("h1").text().trim();

            String posterUrl = null;
            Element img = doc.selectFirst("div.li-img img, .movie-cover img");
            if (img != null) posterUrl = img.attr("abs:src");

            Integer year = extractYear(doc);
            String storyline = extractStoryline(doc);
            String actor = parseTextField(doc, ".actor");
            String director = parseTextField(doc, ".director");
            String genre = parseTextField(doc, ".type");
            String region = parseTextField(doc, ".area");
            BigDecimal score = extractScore(doc);
            Integer totalEpisode = extractEpisodeCount(doc);

            Long contentId = extractContentId(detailUrl);
            Drama existing = dramaService.getById(contentId);
            boolean isNew = (existing == null);

            Drama drama = new Drama();
            drama.setTitle(title);
            drama.setPosterUrl(posterUrl);
            drama.setYear(year);
            drama.setStoryline(storyline);
            drama.setActor(toJsonArray(actor));
            drama.setDirector(toJsonArray(director));
            drama.setGenre(toJsonArray(genre));
            drama.setRegion(toJsonArray(region));
            drama.setScoreDouban(score);
            drama.setTotalEpisode(totalEpisode);
            drama.setStatus(1);

            dramaService.save(drama);
            extractMovieResources(doc, "drama", drama.getId());
            return new int[]{isNew ? 1 : 0, isNew ? 0 : 1, 0};
        } catch (Exception e) {
            log.error("Drama detail parse error: {} - {}", detailUrl, e.getMessage());
            return new int[]{0, 0, 0};
        }
    }

    // ========== Variety Crawler ==========

    // type=3 综艺列表
    public int[] crawlVarietyList(int startPage, int maxItems) {
        int added = 0, updated = 0, total = 0;
        int page = startPage;

        while (total < maxItems) {
            String listUrl = getListUrl("3", page);
            Document listDoc = fetchWithRetry(listUrl);
            if (listDoc == null) break;

            Elements links = listDoc.select("a[href^='/mv/']");
            if (links.isEmpty()) break;

            for (Element link : links) {
                if (total >= maxItems) break;
                String href = link.attr("href");
                if (!href.matches("/mv/\\d+\\.html")) continue;
                String detailUrl = BASE_URL + href;
                int[] r = crawlVarietyDetail(detailUrl);
                if (r[0] == 1) added++;
                if (r[1] == 1) updated++;
                total++;
            }
            page++;
        }
        return new int[]{added, updated, total};
    }

    // type=4 动漫列表
    public int[] crawlAnimeList(int startPage, int maxItems) {
        int added = 0, updated = 0, total = 0;
        int page = startPage;

        while (total < maxItems) {
            String listUrl = getListUrl("4", page);
            Document listDoc = fetchWithRetry(listUrl);
            if (listDoc == null) break;

            Elements links = listDoc.select("a[href^='/mv/']");
            if (links.isEmpty()) break;

            for (Element link : links) {
                if (total >= maxItems) break;
                String href = link.attr("href");
                if (!href.matches("/mv/\\d+\\.html")) continue;
                String detailUrl = BASE_URL + href;
                int[] r = crawlAnimeDetail(detailUrl);
                if (r[0] == 1) added++;
                if (r[1] == 1) updated++;
                total++;
            }
            page++;
        }
        return new int[]{added, updated, total};
    }

    // type=30 短剧列表
    public int[] crawlShortDramaList(int startPage, int maxItems) {
        int added = 0, updated = 0, total = 0;
        int page = startPage;

        while (total < maxItems) {
            String listUrl = getListUrl("30", page);
            Document listDoc = fetchWithRetry(listUrl);
            if (listDoc == null) break;

            Elements links = listDoc.select("a[href^='/mv/']");
            if (links.isEmpty()) break;

            for (Element link : links) {
                if (total >= maxItems) break;
                String href = link.attr("href");
                if (!href.matches("/mv/\\d+\\.html")) continue;
                String detailUrl = BASE_URL + href;
                int[] r = crawlShortDramaDetail(detailUrl);
                if (r[0] == 1) added++;
                if (r[1] == 1) updated++;
                total++;
            }
            page++;
        }
        return new int[]{added, updated, total};
    }

    public int[] crawlVarietyDetail(String detailUrl) {
        Document doc = fetchWithRetry(detailUrl);
        if (doc == null) return new int[]{0, 0, 0};

        try {
            String title = doc.selectFirst("h1").text().trim();
            String posterUrl = null;
            Element img = doc.selectFirst("div.li-img img, .movie-cover img");
            if (img != null) posterUrl = img.attr("abs:src");
            Integer year = extractYear(doc);
            String storyline = extractStoryline(doc);
            String actor = parseTextField(doc, ".actor");
            String genre = parseTextField(doc, ".type");
            Integer totalEpisode = extractEpisodeCount(doc);

            Long contentId = extractContentId(detailUrl);
            Variety existing = varietyService.getById(contentId);
            boolean isNew = (existing == null);

            Variety variety = new Variety();
            variety.setTitle(title);
            variety.setPosterUrl(posterUrl);
            variety.setYear(year);
            variety.setStoryline(storyline);
            variety.setActor(toJsonArray(actor));
            variety.setGenre(toJsonArray(genre));
            variety.setTotalEpisode(totalEpisode);
            variety.setStatus(1);

            varietyService.save(variety);
            return new int[]{isNew ? 1 : 0, isNew ? 0 : 1, 0};
        } catch (Exception e) {
            log.error("Variety detail parse error: {}", detailUrl, e.getMessage());
            return new int[]{0, 0, 0};
        }
    }

    // ========== Resource Extraction ==========

    public int[] crawlAnimeDetail(String detailUrl) {
        Document doc = fetchWithRetry(detailUrl);
        if (doc == null) return new int[]{0, 0, 0};

        try {
            String title = doc.selectFirst("h1").text().trim();
            String posterUrl = null;
            Element img = doc.selectFirst("div.li-img img, .movie-cover img");
            if (img != null) posterUrl = img.attr("abs:src");
            Integer year = extractYear(doc);
            String storyline = extractStoryline(doc);
            String actor = parseTextField(doc, ".actor");
            String director = parseTextField(doc, ".director");
            String genre = parseTextField(doc, ".type");
            Integer totalEpisode = extractEpisodeCount(doc);

            Long contentId = extractContentId(detailUrl);
            Anime existing = animeService.getById(contentId);
            boolean isNew = (existing == null);

            Anime anime = new Anime();
            anime.setTitle(title);
            anime.setPosterUrl(posterUrl);
            anime.setYear(year);
            anime.setStoryline(storyline);
            anime.setActor(toJsonArray(actor));
            anime.setDirector(toJsonArray(director));
            anime.setGenre(toJsonArray(genre));
            anime.setTotalEpisode(totalEpisode);
            anime.setStatus(1);

            animeService.save(anime);
            return new int[]{isNew ? 1 : 0, isNew ? 0 : 1, 0};
        } catch (Exception e) {
            log.error("Anime detail parse error: {}", detailUrl, e.getMessage());
            return new int[]{0, 0, 0};
        }
    }

    public int[] crawlShortDramaDetail(String detailUrl) {
        Document doc = fetchWithRetry(detailUrl);
        if (doc == null) return new int[]{0, 0, 0};

        try {
            String title = doc.selectFirst("h1").text().trim();
            String posterUrl = null;
            Element img = doc.selectFirst("div.li-img img, .movie-cover img");
            if (img != null) posterUrl = img.attr("abs:src");
            Integer year = extractYear(doc);
            String storyline = extractStoryline(doc);
            String actor = parseTextField(doc, ".actor");
            String genre = parseTextField(doc, ".type");
            Integer totalEpisode = extractEpisodeCount(doc);

            Long contentId = extractContentId(detailUrl);
            ShortDrama existing = shortDramaService.getById(contentId);
            boolean isNew = (existing == null);

            ShortDrama shortDrama = new ShortDrama();
            shortDrama.setTitle(title);
            shortDrama.setPosterUrl(posterUrl);
            shortDrama.setYear(year);
            shortDrama.setStoryline(storyline);
            shortDrama.setActor(toJsonArray(actor));
            shortDrama.setGenre(toJsonArray(genre));
            shortDrama.setTotalEpisode(totalEpisode);
            shortDrama.setStatus(1);

            shortDramaService.save(shortDrama);
            return new int[]{isNew ? 1 : 0, isNew ? 0 : 1, 0};
        } catch (Exception e) {
            log.error("Short drama detail parse error: {}", detailUrl, e.getMessage());
            return new int[]{0, 0, 0};
        }
    }

    // ========== Resource Extraction ==========

    private void extractMovieResources(Document doc, String contentType, Long contentId) {
        int magnetSort = 0;
        int onlineSort = 0;

        // Magnet links
        Elements magnetLinks = doc.select("a[href^=magnet:]");
        for (Element el : magnetLinks) {
            String url = el.attr("href");
            if (!url.startsWith("magnet:")) continue;
            String text = el.text();

            ResourceMagnet magnet = new ResourceMagnet();
            magnet.setContentType(contentType);
            magnet.setContentId(contentId);
            magnet.setTitle(text);
            magnet.setMagnetUrl(url);
            magnet.setResolution(extractResolution(text));
            magnet.setHasSubtitle(text.contains("sub") || text.contains("zh") ? Boolean.TRUE : Boolean.FALSE);
            magnet.setIsSpecialSub(text.contains("special") || text.contains("特效") ? Boolean.TRUE : Boolean.FALSE);
            magnet.setSort(magnetSort++);
            magnetMapper.insert(magnet);
        }

        // Online playback sources
        Elements playLinks = doc.select("a[href*=player], a[href^=/play/], .stui-vodlist__item a[href]");
        for (Element el : playLinks) {
            String href = el.attr("href");
            if (href.isEmpty() || href.startsWith("javascript")) continue;
            if (!href.contains("player") && !href.startsWith("http")) continue;

            String name = el.text().trim();
            if (name.isEmpty()) name = "Online Source";

            ResourceOnline online = new ResourceOnline();
            online.setContentType(contentType);
            online.setContentId(contentId);
            online.setSourceName(name);
            online.setSourceUrl(href.startsWith("http") ? href : BASE_URL + href);
            online.setSort(onlineSort++);
            onlineMapper.insert(online);
        }

        // Cloud disk links
        Elements cloudLinks = doc.select("a[href*=pan.baidu], a[href*=quark], a[href*=lanzou], a[href*=xunlei]");
        for (Element el : cloudLinks) {
            String href = el.attr("href");
            if (href.isEmpty() || href.startsWith("javascript")) continue;
            String text = el.text();

            ResourceCloud cloud = new ResourceCloud();
            cloud.setContentType(contentType);
            cloud.setContentId(contentId);
            cloud.setDiskType(detectDiskType(href));
            cloud.setTitle(text);
            cloud.setUrl(href);
            cloud.setSort(0);
            cloudMapper.insert(cloud);
        }
    }

    // ========== HTTP Helper ==========

    private Document fetchWithRetry(String url) {
        for (int i = 0; i < RETRY_TIMES; i++) {
            try {
                Document doc = Jsoup.connect(url)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                        .referrer(BASE_URL)
                        .timeout(TIMEOUT_MS)
                        .ignoreHttpErrors(true)
                        .get();
                if (doc != null && !doc.body().text().isEmpty()) {
                    return doc;
                }
            } catch (Exception e) {
                log.warn("Fetch failed {} ({}/{}): {}", url, i + 1, RETRY_TIMES, e.getMessage());
                try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
            }
        }
        return null;
    }

    // ========== Field Parsing Helpers ==========

    private String parseTextField(Document doc, String selector) {
        Element el = doc.selectFirst(selector);
        return (el != null) ? el.text().trim() : "";
    }

    private String extractStoryline(Document doc) {
        Element el = doc.selectFirst(".movie-introduce, .introduce, .desc, .summary");
        if (el != null) {
            String text = el.text().trim();
            if (!text.isEmpty()) return text;
        }
        Element metaDesc = doc.selectFirst("meta[name=description]");
        return (metaDesc != null) ? metaDesc.attr("content").trim() : "";
    }

    private Integer extractYear(Document doc) {
        Element el = doc.selectFirst(".year, .data, span.year");
        if (el == null) return null;
        Matcher m = YEAR_PATTERN.matcher(el.text());
        return m.find() ? Integer.parseInt(m.group(1)) : null;
    }

    private BigDecimal extractScore(Document doc) {
        Element el = doc.selectFirst(".score, [class*=score], .rating");
        if (el == null) return null;
        String text = el.text().replaceAll("[^0-9.]", "");
        if (text.isEmpty()) return null;
        try { return new BigDecimal(text); } catch (Exception ignored) { return null; }
    }

    private Integer extractEpisodeCount(Document doc) {
        Element el = doc.selectFirst(".total, .episode, [class*=episode]");
        if (el == null) return null;
        Matcher m = Pattern.compile("(\\d+)").matcher(el.text());
        return m.find() ? Integer.parseInt(m.group(1)) : null;
    }

    private String extractResolution(String text) {
        if (text.contains("4K") || text.contains("2160")) return "4K";
        if (text.contains("1080") || text.contains("全高清")) return "1080P";
        if (text.contains("720")) return "720P";
        if (text.contains("480")) return "480P";
        return "Unknown";
    }

    private String detectDiskType(String url) {
        if (url.contains("pan.baidu") || url.contains("baidu.com")) return "baidu";
        if (url.contains("quark")) return "quark";
        if (url.contains("lanzou") || url.contains("lanzouk")) return "lanzou";
        if (url.contains("xunlei") || url.contains("thunder")) return "xunlei";
        return "other";
    }

    private Long extractContentId(String url) {
        Matcher m = ID_PATTERN.matcher(url);
        return m.find() ? Long.parseLong(m.group(1)) : 0L;
    }

    private String toJsonArray(String text) {
        if (text == null || text.isEmpty()) return "[]";
        if (text.startsWith("[")) return text;
        String[] parts = text.split("[/,，、]");
        if (parts.length > 1) {
            List<String> list = new ArrayList<>();
            for (String p : parts) {
                String trimmed = p.trim();
                if (!trimmed.isEmpty()) list.add(trimmed);
            }
            try { return objectMapper.writeValueAsString(list); } catch (Exception ignored) { return text; }
        }
        try { return objectMapper.writeValueAsString(List.of(text.trim())); } catch (Exception ignored) { return text; }
    }
}
