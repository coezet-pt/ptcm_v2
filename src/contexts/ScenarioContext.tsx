import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ScenarioConfig, PolicyConfig, ParameterKey, FixedParameters, SegmentBasePrice, ParameterConfig } from '@/lib/types';
import type { ScenarioName, VehicleSize } from '@/lib/constants/extracted';
import { BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES } from '@/lib/constants/extracted';
import { SCENARIO_CONFIGS } from '@/lib/constants/scenarios';

// v4 Dashboard CAGR-range → years map. Editing one CAGR clears overrides in its range.
const RANGE_YEARS: Record<string, number[]> = {
  d2530: [2026, 2027, 2028, 2029, 2030],
  d3135: [2031, 2032, 2033, 2034, 2035],
  d3640: [2036, 2037, 2038, 2039, 2040],
  d4145: [2041, 2042, 2043, 2044, 2045],
  d4650: [2046, 2047, 2048, 2049, 2050],
  d5155: [2051, 2052, 2053, 2054, 2055],
};

// Build the default BAU config from constants
const bauConfig: ScenarioConfig = {
  parameters: { ...BAU_PARAMETERS } as ScenarioConfig['parameters'],
  policy: { ...BAU_POLICY },
  fixed: structuredClone(BAU_FIXED) as FixedParameters,
  segmentBasePrices: structuredClone(BAU_SEGMENT_BASE_PRICES) as ScenarioConfig['segmentBasePrices'],
};

interface ScenarioContextValue {
  presets: Record<ScenarioName, { id: string; description: string; config: ScenarioConfig }>;
  loading: boolean;
  activeScenario: ScenarioName | 'Custom';
  config: ScenarioConfig;
  draftConfig: ScenarioConfig;
  isDirty: boolean;
  setActiveScenario: (name: ScenarioName | 'Custom') => void;
  updateParameter: (key: ParameterKey, field: string, value: number) => void;
  updatePolicy: <K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K]) => void;
  updateFixed: <K extends keyof FixedParameters>(key: K, value: FixedParameters[K]) => void;
  updateSegmentPrice: (size: VehicleSize, field: keyof SegmentBasePrice, value: number) => void;
  resetToBAU: () => void;
  resetToDefaults: () => void;
  updateBucketMaintenance: (metric: 'diesel' | 'bet' | 'fcet', bucketId: string, field: keyof ParameterConfig, value: number) => void;
  setParameterOverride: (key: ParameterKey, year: number, value: number) => void;
  clearParameterOverride: (key: ParameterKey, year: number) => void;
  setBucketOverride: (metric: 'diesel' | 'bet' | 'fcet', bucketId: string, year: number, value: number) => void;
  clearBucketOverride: (metric: 'diesel' | 'bet' | 'fcet', bucketId: string, year: number) => void;
  applyChanges: () => void;
  discardChanges: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

function ensureFullConfig(cfg: Partial<ScenarioConfig> | undefined): ScenarioConfig {
  return {
    parameters: { ...bauConfig.parameters, ...(cfg?.parameters ?? {}) } as ScenarioConfig['parameters'],
    policy: { ...bauConfig.policy, ...(cfg?.policy ?? {}) },
    fixed: { ...bauConfig.fixed, ...(cfg?.fixed ?? {}) },
    segmentBasePrices: { ...bauConfig.segmentBasePrices, ...(cfg?.segmentBasePrices ?? {}) },
  };
}

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [presets, setPresets] = useState<ScenarioContextValue['presets']>({} as any);
  const [loading, setLoading] = useState(true);
  const [activeScenario, setActiveScenarioState] = useState<ScenarioName | 'Custom'>('BAU');
  const [config, setConfig] = useState<ScenarioConfig>(structuredClone(bauConfig));
  const [draftConfig, setDraftConfig] = useState<ScenarioConfig>(structuredClone(bauConfig));
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    supabase
      .from('scenarios')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const map: any = {};
          for (const row of data) {
            const name = row.name as ScenarioName;
            const hasConfig = row.config && Object.keys(row.config as object).length > 0;
            const fallback = SCENARIO_CONFIGS[name] ?? bauConfig;
            const raw = hasConfig ? (row.config as unknown as Partial<ScenarioConfig>) : fallback;
            map[name] = {
              id: row.id,
              description: row.description || '',
              config: ensureFullConfig(raw),
            };
          }
          setPresets(map);
        }
        setLoading(false);
      });
  }, []);

  const setActiveScenario = useCallback((name: ScenarioName | 'Custom') => {
    setActiveScenarioState(name);
    if (name !== 'Custom' && presets[name]) {
      const next = structuredClone(presets[name].config);
      setConfig(next);
      setDraftConfig(structuredClone(next));
      setIsDirty(false);
    }
  }, [presets]);

  const updateParameter = useCallback((key: ParameterKey, field: string, value: number) => {
    setActiveScenarioState('Custom');
    setIsDirty(true);
    setDraftConfig(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: clearOverridesInRangeIfCagr(
          { ...prev.parameters[key], [field]: value },
          field,
        ),
      },
    }));
  }, []);

  const setParameterOverride = useCallback((key: ParameterKey, year: number, value: number) => {
    setActiveScenarioState('Custom');
    setIsDirty(true);
    setDraftConfig(prev => {
      const p = prev.parameters[key];
      return {
        ...prev,
        parameters: {
          ...prev.parameters,
          [key]: { ...p, overrides: { ...(p.overrides ?? {}), [year]: value } },
        },
      };
    });
  }, []);

  const clearParameterOverride = useCallback((key: ParameterKey, year: number) => {
    setActiveScenarioState('Custom');
    setIsDirty(true);
    setDraftConfig(prev => {
      const p = prev.parameters[key];
      if (!p.overrides) return prev;
      const next = { ...p.overrides };
      delete next[year];
      return {
        ...prev,
        parameters: { ...prev.parameters, [key]: { ...p, overrides: next } },
      };
    });
  }, []);

  const updatePolicy = useCallback(<K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K]) => {
    setActiveScenarioState('Custom');
    setIsDirty(true);
    setDraftConfig(prev => ({
      ...prev,
      policy: { ...prev.policy, [key]: value },
    }));
  }, []);

  const updateFixed = useCallback(<K extends keyof FixedParameters>(key: K, value: FixedParameters[K]) => {
    setActiveScenarioState('Custom');
    setIsDirty(true);
    setDraftConfig(prev => ({
      ...prev,
      fixed: { ...prev.fixed, [key]: value },
    }));
  }, []);

  const updateSegmentPrice = useCallback((size: VehicleSize, field: keyof SegmentBasePrice, value: number) => {
    setActiveScenarioState('Custom');
    setIsDirty(true);
    setDraftConfig(prev => ({
      ...prev,
      segmentBasePrices: {
        ...prev.segmentBasePrices,
        [size]: { ...prev.segmentBasePrices[size], [field]: value },
      },
    }));
  }, []);

  const resetToBAU = useCallback(() => {
    setActiveScenarioState('BAU');
    const next = structuredClone(bauConfig);
    setConfig(next);
    setDraftConfig(structuredClone(next));
    setIsDirty(false);
  }, []);

  const resetToDefaults = useCallback(() => {
    const next = structuredClone(bauConfig);
    setActiveScenarioState('BAU');
    setConfig(next);
    setDraftConfig(structuredClone(next));
    setIsDirty(false);
  }, []);

  const updateBucketMaintenance = useCallback(
    (metric: 'diesel' | 'bet' | 'fcet', bucketId: string, field: keyof ParameterConfig, value: number) => {
      setActiveScenarioState('Custom');
      setIsDirty(true);
      setDraftConfig(prev => {
        const bm = prev.fixed.bucket_maintenance ?? { diesel: {}, bet: {}, fcet: {} };
        const group = { ...(bm[metric] ?? {}) };
        const current = group[bucketId] ?? {
          baseValue: 0, d2530: 0, d3135: 0, d3640: 0, d4145: 0, d4650: 0, d5155: 0,
        };
        group[bucketId] = clearOverridesInRangeIfCagr(
          { ...current, [field]: value },
          field as string,
        );
        return {
          ...prev,
          fixed: {
            ...prev.fixed,
            bucket_maintenance: { ...bm, [metric]: group },
          },
        };
      });
    },
    [],
  );

  const setBucketOverride = useCallback(
    (metric: 'diesel' | 'bet' | 'fcet', bucketId: string, year: number, value: number) => {
      setActiveScenarioState('Custom');
      setIsDirty(true);
      setDraftConfig(prev => {
        const bm = prev.fixed.bucket_maintenance ?? { diesel: {}, bet: {}, fcet: {} };
        const group = { ...(bm[metric] ?? {}) };
        const current = group[bucketId] ?? {
          baseValue: 0, d2530: 0, d3135: 0, d3640: 0, d4145: 0, d4650: 0, d5155: 0,
        };
        group[bucketId] = { ...current, overrides: { ...(current.overrides ?? {}), [year]: value } };
        return {
          ...prev,
          fixed: { ...prev.fixed, bucket_maintenance: { ...bm, [metric]: group } },
        };
      });
    },
    [],
  );

  const clearBucketOverride = useCallback(
    (metric: 'diesel' | 'bet' | 'fcet', bucketId: string, year: number) => {
      setActiveScenarioState('Custom');
      setIsDirty(true);
      setDraftConfig(prev => {
        const bm = prev.fixed.bucket_maintenance;
        if (!bm?.[metric]?.[bucketId]?.overrides) return prev;
        const group = { ...bm[metric] };
        const current = { ...group[bucketId] };
        const o = { ...(current.overrides ?? {}) };
        delete o[year];
        current.overrides = o;
        group[bucketId] = current;
        return {
          ...prev,
          fixed: { ...prev.fixed, bucket_maintenance: { ...bm, [metric]: group } },
        };
      });
    },
    [],
  );

  const applyChanges = useCallback(() => {
    setConfig(structuredClone(draftConfig));
    setIsDirty(false);
  }, [draftConfig]);

  const discardChanges = useCallback(() => {
    setDraftConfig(structuredClone(config));
    setIsDirty(false);
  }, [config]);

  return (
    <ScenarioContext.Provider value={{
      presets, loading, activeScenario, config, draftConfig, isDirty,
      setActiveScenario, updateParameter, updatePolicy, updateFixed, updateSegmentPrice,
      resetToBAU, resetToDefaults, updateBucketMaintenance,
      setParameterOverride, clearParameterOverride,
      setBucketOverride, clearBucketOverride,
      applyChanges, discardChanges,
    }}>
      {children}
    </ScenarioContext.Provider>
  );
}

/** If `field` is one of the six CAGR keys, drop any overrides whose year falls in that range. */
function clearOverridesInRangeIfCagr(cfg: ParameterConfig, field: string): ParameterConfig {
  const years = RANGE_YEARS[field];
  if (!years || !cfg.overrides) return cfg;
  const next = { ...cfg.overrides };
  for (const y of years) delete next[y];
  return { ...cfg, overrides: next };
}

export function useScenario() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be inside ScenarioProvider');
  return ctx;
}
