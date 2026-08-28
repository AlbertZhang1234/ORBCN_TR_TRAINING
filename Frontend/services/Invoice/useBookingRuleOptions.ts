'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listBookingRules,
  toBookingRuleOptions,
  type BookingRuleOption,
} from './booking-rules';

export function useBookingRuleOptions(currentCode = ''): {
  options: BookingRuleOption[];
  error: string;
} {
  const [options, setOptions] = useState<BookingRuleOption[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listBookingRules()
      .then((rules) => {
        if (active) {
          setOptions(toBookingRuleOptions(rules));
          setError('');
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Failed to load booking rules');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const normalizedCurrentCode = currentCode.trim();
  const visibleOptions = useMemo(() => {
    if (!normalizedCurrentCode || options.some((option) => option.code === normalizedCurrentCode)) {
      return options;
    }
    return [
      ...options,
      {
        code: normalizedCurrentCode,
        category: 'inactive',
        labelZh: normalizedCurrentCode,
        labelEn: normalizedCurrentCode,
      },
    ];
  }, [normalizedCurrentCode, options]);

  return { options: visibleOptions, error };
}
