import { useState, useEffect } from 'react';
import { type PubSubManager } from '@engine';
import { AccordionPrimitive } from "@components/Primitive/Accordion/AccordionPrimitive";
import { SelectPrimitive } from "@components/Primitive/Select/SelectPrimitive";
import { SANDBOX_EVENTS } from '../../../../game/events';
import type { ScriptArgValues } from '../../../../game/scripts/ScriptContract';
import { getParamNames, getParamDefaults } from '../../../../game/utils/functionParser';
import { ScriptArgsForm } from './ScriptArgsForm';

const SCRIPT_LOADERS = import.meta.glob<{ execute: (...args: unknown[]) => unknown }>('../../../../game/scripts/*.ts');

const SCRIPT_NAMES = Object.keys(SCRIPT_LOADERS)
  .map(path => path.split('/').pop()!.replace(/\.ts$/, ''))
  .filter(name => name !== 'ScriptContract');

async function loadScriptParams(scriptName: string): Promise<{ params: string[]; defaults: ScriptArgValues }> {
  const entry = Object.entries(SCRIPT_LOADERS).find(
    ([path]) => !path.includes('ScriptContract') && path.endsWith(`/${scriptName}.ts`),
  );
  if (!entry) return { params: [], defaults: {} };
  const module = await entry[1]();
  if (typeof module.execute !== 'function') return { params: [], defaults: {} };
  const params   = getParamNames(module.execute).filter(p => p !== 'engine');
  const defaults = getParamDefaults(module.execute) as ScriptArgValues;
  return { params, defaults };
}

interface ScriptFormProps {
  initialSelectedScript: string;
  initialScriptArgs:     ScriptArgValues;
  pubSub:                PubSubManager;
  objectIndex:           number;
}

export function ScriptForm({ initialSelectedScript, initialScriptArgs, pubSub, objectIndex }: ScriptFormProps) {
  const [selectedScript, setSelectedScript]   = useState(initialSelectedScript);
  const [scriptParams, setScriptParams]       = useState<string[]>([]);
  const [scriptArgValues, setScriptArgValues] = useState<ScriptArgValues>(initialScriptArgs);

  useEffect(() => {
    if (!initialSelectedScript) return;
    loadScriptParams(initialSelectedScript).then(({ params, defaults }) => {
      setScriptParams(params);
      setScriptArgValues(previous => ({ ...defaults, ...previous }));
    });
  }, []);

  const options = SCRIPT_NAMES.map((name) => ({ value: name, label: name }));

  function handleScriptChange(name: string): void {
    setSelectedScript(name);
    setScriptParams([]);
    setScriptArgValues({});
    pubSub.publish(SANDBOX_EVENTS.PROPERTY_SCRIPT_CHANGED, { objectIndex, data: { scriptName: name } });
    if (name) {
      loadScriptParams(name).then(({ params, defaults }) => {
        setScriptParams(params);
        setScriptArgValues(defaults);
      });
    }
  }

  return (
    <>
      <AccordionPrimitive title="Script">
        <div className="prop-row">
          <SelectPrimitive
            label="Script"
            labelId="script-select-label"
            value={selectedScript}
            options={options}
            onChange={handleScriptChange}
          />
        </div>
      </AccordionPrimitive>
      {scriptParams.length > 0 && (
        <ScriptArgsForm
          params={scriptParams}
          values={scriptArgValues}
          onApply={(args) => {
            setScriptArgValues(args);
            pubSub.publish(SANDBOX_EVENTS.PROPERTY_SCRIPT_ARGS_CHANGED, { objectIndex, data: { args } });
          }}
        />
      )}
    </>
  );
}
