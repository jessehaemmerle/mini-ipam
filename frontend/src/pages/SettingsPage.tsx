import { PageHeader } from "../components/common/PageHeader";
import { useSettings } from "../context/SettingsContext";

export function SettingsPage() {
  const { theme, setTheme, language, setLanguage, labels } = useSettings();

  return (
    <div className="space-y-4">
      <PageHeader title={labels.settings.title} subtitle={labels.settings.subtitle} />

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{labels.settings.theme}</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={theme === "dark"}
              onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
            />
            {labels.settings.darkMode}
          </label>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">{labels.settings.language}</span>
          <select
            className="input"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "de" | "en")}
          >
            <option value="de">{labels.settings.german}</option>
            <option value="en">{labels.settings.english}</option>
          </select>
        </div>
      </div>
    </div>
  );
}

