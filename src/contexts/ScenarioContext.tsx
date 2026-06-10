import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ScenarioConfig, PolicyConfig, ParameterKey, FixedParameters, SegmentBasePrice, ParameterConfig } from '@/lib/types';
import type { ScenarioName, VehicleSize } from '@/lib/constants/extracted';
import { BAU_PARAMETERS, BAU_POLICY, BAU_FIXED, BAU_SEGMENT_BASE_PRICES } from '@/lib/constants/extracted';
import { SCENARIO_CONFIGS } from '@/lib/constants/scenarios';

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
        [key]: { ...prev.parameters[key], [field]: value },
      },
    }));
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
        group[bucketId] = { ...current, [field]: value };
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
      resetToBAU, resetToDefaults, updateBucketMaintenance, applyChanges, discardChanges,
    }}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useScenario must be inside ScenarioProvider');
  return ctx;
}
