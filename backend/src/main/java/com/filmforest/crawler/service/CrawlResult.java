package com.filmforest.crawler.service;

import com.filmforest.content.entity.Movie;
import com.filmforest.content.entity.Drama;
import com.filmforest.content.entity.Variety;
import com.filmforest.content.entity.Anime;
import com.filmforest.content.entity.ShortDrama;
import lombok.Data;

/**
 * 爬虫结果封装
 */
@Data
public class CrawlResult {
    private int success;
    private int fail;
    private String message;

    public static CrawlResult ok(int success, String msg) {
        CrawlResult r = new CrawlResult();
        r.setSuccess(success);
        r.setFail(0);
        r.setMessage(msg);
        return r;
    }

    public static CrawlResult fail(int fail, String msg) {
        CrawlResult r = new CrawlResult();
        r.setSuccess(0);
        r.setFail(fail);
        r.setMessage(msg);
        return r;
    }
}