'use client';

import { useCallback, useEffect, useState } from 'react';
import { listPagePreferenceApi, type AdminListPagePreferenceKey } from '@/lib/api';

export const DEFAULT_LIST_PAGE_SIZE = 10;
export const MIN_LIST_PAGE_SIZE = 2;
export const MAX_LIST_PAGE_SIZE = 100;

function normalize(value: number) {
  if (!Number.isInteger(value) || value < MIN_LIST_PAGE_SIZE || value > MAX_LIST_PAGE_SIZE) {
    throw new Error(`每页条数必须是 ${MIN_LIST_PAGE_SIZE} 到 ${MAX_LIST_PAGE_SIZE} 之间的整数`);
  }
  return value;
}

export function useListPageSize(key: AdminListPagePreferenceKey) {
  const [size, setSize] = useState(DEFAULT_LIST_PAGE_SIZE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void listPagePreferenceApi.get()
      .then(response => {
        const value = Number(response.data?.data?.[key]);
        if (active && Number.isInteger(value) && value >= MIN_LIST_PAGE_SIZE && value <= MAX_LIST_PAGE_SIZE) {
          setSize(value);
        }
      })
      .catch(() => {
        // 旧版本服务端或离线时沿用安全默认值；不阻塞列表读取。
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, [key]);

  const updateSize = useCallback(async (value: number) => {
    const next = normalize(value);
    const previous = size;
    setSize(next);
    setSaving(true);
    try {
      const response = await listPagePreferenceApi.update(key, next);
      const persisted = Number(response.data?.data?.[key]);
      if (Number.isInteger(persisted) && persisted >= MIN_LIST_PAGE_SIZE && persisted <= MAX_LIST_PAGE_SIZE) {
        setSize(persisted);
      }
    } catch (error) {
      setSize(previous);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [key, size]);

  return { size, loaded, saving, updateSize };
}
