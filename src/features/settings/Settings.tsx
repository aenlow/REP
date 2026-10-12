import { useEffect, useRef, useState } from 'react';
import { useData } from '../../app/store';
import { href } from '../../app/router';
import { Icon } from '../../components/Icon';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { EQUIPMENT } from '../../data/equipment';
import { MAX_IMPORT_BYTES, parseBackup, type ImportPreview } from '../../lib/backup';
import { DEFAULT_SETTINGS } from '../../db/db';
import { downloadText, readText, shareText, stamp } from '../../lib/download';
import { sessionsCsv, setsCsv } from '../../lib/csv-export';
import { subscribeSw, type SwState } from '../../lib/sw-register';
import { formatDate } from '../../lib/format';
import type { BackupFile, EquipmentId } from '../../types';
import { InstallSteps } from '../../app/InstallGuide';

export const BACKUP_REMINDER_DAYS = 14;

export function backupOverdue(lastBackupAt: string | undefined, hasData: boolean, now = Date.now()): boolean {
  if (!hasData) return false;
  if (!lastBackupAt) return true;
  return now - Date.parse(lastBackupAt) > BACKUP_REMINDER_DAYS * 86400000;
}

export function Settings() {
  const { settings, sessions, setLogs, exercises, actions } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ backup: BackupFile; preview: ImportPreview } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sw, setSw] = useState<SwState | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string | null>(null);

  useEffect(() => subscribeSw(setSw), []);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`))
      .catch(() => undefined);
  }, []);

  const overdue = backupOverdue(settings.lastBackupAt, sessions.length > 0);

  const exportJson = async (share: boolean) => {
    const name = `rep-backup-${stamp()}.json`;
    const text = JSON.stringify(actions.exportBackup(), null, 2);
    if (share && (await shareText(name, text, 'application/json'))) {
      await actions.updateSettings({ lastBackupAt: new Date().toISOString() });
      return;
    }
    downloadText(name, text, 'application/json');
    await actions.updateSettings({ lastBackupAt: new Date().toISOString() });
    actions.toast('Backup file created.');
  };

  const onFile = async (f: File | undefined) => {
    setImportError(null);
    setPending(null);
    if (!f) return;
    if (f.size > MAX_IMPORT_BYTES) return setImportError('That file is larger than 10 MB, which is too big for a REP backup.');
    const text = await readText(f);
    const r = parseBackup(text, DEFAULT_SETTINGS, f.size);
    if (!r.ok) return setImportError(r.error);
    setPending({ backup: r.backup, preview: r.preview });
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    try {
      const msg = await actions.importBackup(pending.backup, mode);
      actions.toast(msg);
    } catch {
      /* toast already shown */
    }
    setPending(null);
    setConfirmReplace(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleEquip = (id: EquipmentId, on: boolean) =>
    actions.updateSettings({ ownedEquipment: on ? [...settings.ownedEquipment, id] : settings.ownedEquipment.filter((x) => x !== id) });

  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;

  return (
    <div className="page page--settings">
      <header className="page__head">
        <a className="icon-btn" href={href('/')} aria-label="Back to home">
          <Icon name="left" />
        </a>
        <h1 className="display display--l">Settings</h1>
      </header>

      <section className="section" aria-labelledby="s-units">
        <h2 id="s-units">Units and logging</h2>
        <fieldset className="field">
          <legend className="field__label">Weight unit</legend>
          <div className="seg">
            {(['lb', 'kg'] as const).map((u) => (
              <label key={u} className="seg__opt">
                <input type="radio" name="unit" checked={settings.unit === u} onChange={() => actions.updateSettings({ unit: u })} />
                <span>{u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}</span>
              </label>
            ))}
          </div>
          <p className="muted small">Weights are stored once and converted for display, so switching never changes your records.</p>
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={settings.autoLogPrescribed} onChange={(e) => actions.updateSettings({ autoLogPrescribed: e.target.checked })} />
          <span>
            Quick “Complete” logs the prescription automatically
            <span className="muted small block">When off, REP asks first. Either way, these sets are labelled “as prescribed”.</span>
          </span>
        </label>
      </section>

      <section className="section" aria-labelledby="s-backup">
        <h2 id="s-backup">Backup</h2>
        {overdue ? (
          <p className="notice notice--warn" role="status">
            <Icon name="alert" size={18} /> {settings.lastBackupAt ? `Last backup ${formatDate(settings.lastBackupAt)}.` : 'No backup yet.'} Export one
            and keep it somewhere safe, like iCloud Drive.
          </p>
        ) : settings.lastBackupAt ? (
          <p className="muted">Last backup {formatDate(settings.lastBackupAt)}.</p>
        ) : null}
        <div className="row-actions">
          <button type="button" className="btn btn--solid" onClick={() => exportJson(true)}>
            <Icon name="share" size={18} /> Share backup
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => exportJson(false)}>
            <Icon name="download" size={18} /> Download backup (.json)
          </button>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => downloadText(`rep-sessions-${stamp()}.csv`, sessionsCsv(sessions, setLogs), 'text/csv')}>
            Sessions CSV
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => downloadText(`rep-sets-${stamp()}.csv`, setsCsv(sessions, setLogs, exercises, settings.unit), 'text/csv')}
          >
            Sets CSV
          </button>
        </div>
        <label className="field">
          <span className="field__label">Restore from a backup file</span>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {importError ? (
          <p className="form-error" role="alert">
            {importError}
          </p>
        ) : null}
        <p className="muted small">
          Backups include workouts, exercises, history, notes and settings. Attached media files are not included. A backup is a file you move
          yourself — REP does not sync between devices.
        </p>
      </section>

      <section className="section" aria-labelledby="s-equip">
        <h2 id="s-equip">Your equipment</h2>
        <p className="muted small">Substitutions only suggest exercises you can do with what's checked.</p>
        <div className="check-grid">
          {EQUIPMENT.map((x) => (
            <label key={x.id} className="check">
              <input type="checkbox" checked={settings.ownedEquipment.includes(x.id)} onChange={(e) => toggleEquip(x.id, e.target.checked)} />
              <span>
                {x.name}
                {x.detail ? <span className="muted small block">{x.detail}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <h3>Cable pairings you've checked</h3>
        {settings.verifiedCablePairs.length ? (
          <ul className="plain-list">
            {settings.verifiedCablePairs.map((p) => (
              <li key={p} className="pair-row">
                <span>{p.split('|').map(exName).join(' + ')}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => actions.updateSettings({ verifiedCablePairs: settings.verifiedCablePairs.filter((x) => x !== p) })}
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">None yet. When a block uses both cable sides, REP asks you to confirm the setup fits.</p>
        )}
      </section>

      <section className="section" aria-labelledby="s-offline">
        <h2 id="s-offline">Offline and storage</h2>
        <ul className="plain-list">
          <li>
            {sw?.offlineReady ? (
              <>
                <Icon name="check" size={16} /> Ready to use offline on this device.
              </>
            ) : sw?.supported ? (
              'Preparing offline copy…'
            ) : (
              'Offline mode is only available on the published site.'
            )}
          </li>
          <li>
            {persisted === true
              ? 'Storage is marked persistent.'
              : persisted === false
                ? 'Storage may be cleared by the browser if the device runs low on space or the app goes unused for weeks. Keep backups.'
                : 'Storage persistence status unavailable.'}
            {usage ? ` ${usage}.` : ''}
          </li>
        </ul>
        {persisted === false && navigator.storage?.persist ? (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={async () => {
              const ok = await navigator.storage.persist();
              setPersisted(ok);
              actions.toast(ok ? 'Storage marked persistent.' : 'The browser declined. Installing REP to your Home Screen helps; keep backups either way.');
            }}
          >
            Ask to keep storage
          </button>
        ) : null}
      </section>

      <section className="section" aria-labelledby="s-install">
        <h2 id="s-install">Install on iPhone</h2>
        <InstallSteps />
      </section>

      <section className="section" aria-labelledby="s-privacy">
        <h2 id="s-privacy">Privacy</h2>
        <p>
          Everything you log stays in this browser's storage on this device. REP has no account, no server, no analytics and makes no network
          requests beyond loading its own files. Backup and CSV files contain your workout history and notes — treat them as personal
          information.
        </p>
        <p className="muted small">REP doesn't connect to Apple Health or Apple Watch.</p>
      </section>

      <section className="section" aria-labelledby="s-reset">
        <h2 id="s-reset">Reset</h2>
        <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
          Reset settings
        </button>
        <p className="muted small">Resets units, logging and equipment. Your workouts and history are untouched.</p>
      </section>

      {pending ? (
        <Dialog
          title="Restore this backup?"
          onClose={() => setPending(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmReplace(true)}>
                Replace all
              </button>
              <button type="button" className="btn btn--primary" onClick={() => doImport('merge')}>
                Merge
              </button>
            </>
          }
        >
          <p className="muted">Created {formatDate(pending.preview.exportedAt)} · schema {pending.preview.schemaVersion}</p>
          <dl className="tally">
            {Object.entries(pending.preview.counts).map(([k, v]) => (
              <div key={k}>
                <dt>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
                <dd className="num">{v}</dd>
              </div>
            ))}
          </dl>
          <p>
            <strong>Merge</strong> adds anything new and leaves records already on this device unchanged. <strong>Replace all</strong> makes this
            device match the backup exactly.
          </p>
        </Dialog>
      ) : null}
      {confirmReplace ? (
        <ConfirmDialog
          title="Replace everything on this device?"
          body={<p>All workouts, history and settings here will be replaced by the backup. Export a backup of this device first if you're unsure.</p>}
          confirmLabel="Replace all data"
          destructive
          onCancel={() => setConfirmReplace(false)}
          onConfirm={() => doImport('replace')}
        />
      ) : null}
      {confirmReset ? (
        <ConfirmDialog
          title="Reset settings?"
          body={<p>Units, logging and equipment go back to defaults, and checked cable pairings are forgotten. Workouts and history are kept.</p>}
          confirmLabel="Reset settings"
          destructive
          onCancel={() => setConfirmReset(false)}
          onConfirm={async () => {
            await actions.resetSettings();
            setConfirmReset(false);
            actions.toast('Settings reset.');
          }}
        />
      ) : null}
    </div>
  );
}
