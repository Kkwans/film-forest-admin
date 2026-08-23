import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCORDION_PANEL_BASE_CLASS,
  MODAL_SHELL_GEOMETRY_CLASS,
  REDUCED_MOTION_TRANSITION_CLASS,
  STABLE_POPUP_TRANSITION_CLASS,
  STABLE_TRIGGER_TRANSITION_CLASS,
  filterSelectOptions,
  getAccordionPanelClass,
  getNextOptionIndex,
} from './interaction-contracts.ts';
import { UI_LAYER_CLASSES, UI_LAYER_VALUES, isLayerAbove } from './layers.ts';
import {
  crawlerErrorMessage,
  crawlerStageLabel,
  crawlerStageProgress,
} from '../../app/crawler/components/crawler-progress.ts';
import { parseCrawlerSseFrames } from '../../hooks/crawler-sse.ts';

test('select search keeps matching and selected options', () => {
  const options = [
    { label: '电影', value: 'movie' },
    { label: '剧集', value: 'drama' },
    { label: '动漫', value: 'anime' },
  ];

  assert.deepEqual(
    filterSelectOptions(options, '影', ['drama']).map(option => option.value),
    ['movie', 'drama'],
  );
});

test('search field arrow navigation chooses a stable option index', () => {
  assert.equal(getNextOptionIndex(3, -1, 'next'), 0);
  assert.equal(getNextOptionIndex(3, 0, 'next'), 1);
  assert.equal(getNextOptionIndex(3, -1, 'previous'), 2);
  assert.equal(getNextOptionIndex(0, -1, 'next'), -1);
});

test('overlay layers keep Select above Modal and confirmation Dialog above Select', () => {
  assert.equal(UI_LAYER_CLASSES.popover, 'z-[250]');
  assert.equal(UI_LAYER_CLASSES.modal, 'z-[150]');
  assert.equal(UI_LAYER_CLASSES.dialog, 'z-[350]');
  assert.equal(UI_LAYER_VALUES.popover, 250);
  assert.equal(isLayerAbove('popover', 'modal'), true);
  assert.equal(isLayerAbove('dialog', 'popover'), true);
});

test('accordion animation preserves layout and reduced motion contract', () => {
  const openClass = getAccordionPanelClass(true);
  const closedClass = getAccordionPanelClass(false);

  assert.match(ACCORDION_PANEL_BASE_CLASS, /transition-\[grid-template-rows,opacity\]/);
  assert.match(ACCORDION_PANEL_BASE_CLASS, /min-w-0/);
  assert.match(openClass, /grid-rows-\[1fr\]/);
  assert.match(closedClass, /grid-rows-\[0fr\]/);
  assert.match(openClass, new RegExp(REDUCED_MOTION_TRANSITION_CLASS.replace(':', '\\:')));
  assert.doesNotMatch(ACCORDION_PANEL_BASE_CLASS, /transition-\[(?:[^\]]*width|[^\]]*transform)/);
});

test('trigger and modal geometry contracts avoid press resizing and clip corners', () => {
  assert.doesNotMatch(STABLE_TRIGGER_TRANSITION_CLASS, /width|transform|scale/);
  assert.match(STABLE_POPUP_TRANSITION_CLASS, /transition-opacity/);
  assert.doesNotMatch(STABLE_POPUP_TRANSITION_CLASS, /width|transform|scale/);
  assert.match(MODAL_SHELL_GEOMETRY_CLASS, /overflow-hidden/);
  assert.match(MODAL_SHELL_GEOMETRY_CLASS, /rounded-2xl/);
});

test('crawler progress labels expose Chinese stages and translate watchdog errors', () => {
  assert.equal(crawlerStageLabel('ONLINE'), '在线播放');
  assert.equal(crawlerErrorMessage('Job progress stalled'), '任务进度长时间未推进');
  assert.equal(crawlerErrorMessage('Job heartbeat expired'), '任务心跳已超时');
  assert.equal(crawlerStageProgress('SAVING'), 95);
});

test('crawler SSE parser preserves split frames and multiline data', () => {
  const first = parseCrawlerSseFrames(
    'event: crawler\ndata: {"type":"progress","jobId":9}\n\n' +
    'event: crawler\ndata: {"type":"progress",',
  );
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].jobId, 9);
  assert.equal(first.rest, 'event: crawler\ndata: {"type":"progress",');

  const second = parseCrawlerSseFrames(first.rest + '"jobId":10}\n\n');
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].jobId, 10);
  assert.equal(second.rest, '');
});
