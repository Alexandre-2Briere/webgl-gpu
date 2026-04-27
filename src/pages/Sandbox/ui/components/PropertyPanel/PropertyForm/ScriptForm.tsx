import { useState, useEffect } from 'react';
import { type PubSubManager } from '@engine';
import { AccordionPrimitive } from "@components/Primitive/Accordion/AccordionPrimitive";
import { SelectPrimitive } from "@components/Primitive/Select/SelectPrimitive";
import { SANDBOX_EVENTS } from '../../../../game/events';
import type { GameScriptConstructor, ScriptArgValues } from '../../../../game/scripts/ScriptContract';
import { getParamNames, getParamDefaults } from '../../../../game/utils/functionParser';
import { ScriptArgsForm } from './ScriptArgsForm';

const SCRIPT_MODULES = import.meta.glob<{ default?: GameScriptConstructor }>(
  '../../../../game/scripts/*.ts',
  { eager: true },
);

function isGameScriptClass(value: unknown): value is GameScriptConstructor {
  return (
    typeof value === 'function' &&
    typeof (value as GameScriptConstructor).prototype?.execute === 'function' &&
    typeof (value as GameScriptConstructor).prototype?.update === 'function'
  );
}

const SCRIPT_NAMES = Object.entries(SCRIPT_MODULES)
  .filter(([, module]) => isGameScriptClass(module.default))
  .map(([path]) => path.split('/').pop()!.replace(/\.ts$/, ''));

function loadScriptParams(scriptName: string): { params: string[]; defaults: ScriptArgValues } {
  const entry = Object.entries(SCRIPT_MODULES).find(([path]) =>
    path.endsWith(`/${scriptName}.ts`),
  );
  const Ctor = entry?.[1].default;
  if (!isGameScriptClass(Ctor)) return { params: [], defaults: {} };

  const executeParams = getParamNames(Ctor.prototype.execute).filter(p => p !== 'engine');
  const updateParams  = getParamNames(Ctor.prototype.update).filter(p => p !== 'deltaTime_number');
  const params        = [...new Set([...executeParams, ...updateParams])];
  const defaults      = {
    ...getParamDefaults(Ctor.prototype.execute),
    ...getParamDefaults(Ctor.prototype.update),
  } as ScriptArgValues;

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
    const { params, defaults } = loadScriptParams(initialSelectedScript);
    setScriptParams(params);
    setScriptArgValues(previous => ({ ...defaults, ...previous }));
  }, []);

  const options = SCRIPT_NAMES.map((name) => ({ value: name, label: name }));

  function handleScriptChange(name: string): void {
    setSelectedScript(name);
    setScriptParams([]);
    setScriptArgValues({});
    pubSub.publish(SANDBOX_EVENTS.PROPERTY_SCRIPT_CHANGED, { objectIndex, data: { scriptName: name } });
    if (name) {
      const { params, defaults } = loadScriptParams(name);
      setScriptParams(params);
      setScriptArgValues(defaults);
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
