import { UiSettings } from '../types';

interface SettingsPanelProps {
  settings: UiSettings;
  onChange: (settings: UiSettings) => void;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5">
      <span className="text-sm">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/20 p-5 space-y-4">
        <h2 className="text-sm uppercase tracking-[0.2em] text-white/65">Appearance</h2>
        <label className="block">
          <span className="text-sm text-white/75 block mb-2">Accent Color</span>
          <input
            type="color"
            value={settings.accentColor}
            onChange={(e) => onChange({ ...settings, accentColor: e.target.value })}
            className="w-24 h-10 bg-transparent border border-white/20 rounded"
          />
        </label>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-5 space-y-3">
        <h2 className="text-sm uppercase tracking-[0.2em] text-white/65">Experience</h2>
        <Toggle
          label="Compact mode"
          checked={settings.compactMode}
          onChange={(value) => onChange({ ...settings, compactMode: value })}
        />
        <Toggle
          label="Enable animations"
          checked={settings.animations}
          onChange={(value) => onChange({ ...settings, animations: value })}
        />
        <Toggle
          label="Show timestamps"
          checked={settings.showTimestamps}
          onChange={(value) => onChange({ ...settings, showTimestamps: value })}
        />
        <Toggle
          label="Use planning mode in chat"
          checked={settings.usePlanMode}
          onChange={(value) => onChange({ ...settings, usePlanMode: value })}
        />
      </div>
    </section>
  );
}
