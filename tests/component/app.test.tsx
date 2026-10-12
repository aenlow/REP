import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/App';
import { openRepDb } from '../../src/db/db';
import { navigate } from '../../src/app/router';
import { dbName } from '../helpers';
import { readText } from '../../src/lib/download';

function renderApp(name = dbName()) {
  const user = userEvent.setup();
  const utils = render(<App dbFactory={() => openRepDb(name)} />);
  return { user, name, ...utils };
}

async function startWorkoutA(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Start Workout A' }));
  await screen.findByRole('heading', { level: 1, name: 'Hyperextensions' });
}

describe('Home', () => {
  it('first run looks complete with no fake history', async () => {
    renderApp();
    expect(await screen.findByText('Next in rotation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A');
    expect(screen.getByText('No sessions logged')).toBeInTheDocument();
    expect(screen.getByText(/Finish a session and it will show up here/)).toBeInTheDocument();
    expect(screen.getByText('Rotation A → B')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mobility and recovery/ })).toBeInTheDocument();
  });

  it('shows a clear error when storage cannot open', async () => {
    render(<App dbFactory={() => Promise.reject(new Error('IndexedDB is not available in this browser.'))} />);
    expect(await screen.findByRole('heading', { name: 'Storage unavailable' })).toBeInTheDocument();
    expect(screen.getByText(/no IndexedDB storage/)).toBeInTheDocument();
  });
});

describe('Workout browser', () => {
  it('lists A and B with structure, duration and actions', async () => {
    renderApp();
    await screen.findByText('Next in rotation');
    navigate('/workouts');
    const a = (await screen.findByText('Workout A', { selector: 'strong' })).closest('li')!;
    expect(within(a).getByText(/3 blocks · 9 exercises · about 45 min · 3×3×3/)).toBeInTheDocument();
    expect(within(a).getByText('Not done yet')).toBeInTheDocument();
    expect(within(a).getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(within(a).getByRole('link', { name: /View \/ edit/ })).toBeInTheDocument();
  });

  it('locks the seated cable row when adding to Workout B block 1, with the reason', async () => {
    const { user } = renderApp();
    await screen.findByText('Next in rotation');
    navigate('/workouts/workout-b');
    await screen.findByRole('heading', { name: /Block\s*01/ });
    await user.click(screen.getAllByRole('button', { name: /Add exercise/ })[0]!);
    const dialog = await screen.findByRole('dialog');
    const row = within(dialog).getByRole('button', { name: /Seated cable row/ });
    expect(row).toBeDisabled();
    expect(row).toHaveTextContent(/lowered into the rack/);
  });

  it('edits a prescribed weight and saves it', async () => {
    const { user } = renderApp();
    await screen.findByText('Next in rotation');
    navigate('/workouts/workout-a');
    await user.click(await screen.findByRole('button', { name: 'Edit Barbell incline bench press' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Increase Prescribed weight by 5' }));
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.getByText(/80 lb/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save workout' }));
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
  });
});

describe('Active workout', () => {
  it('shows position, prescription and honest last-session state', async () => {
    const { user } = renderApp();
    await startWorkoutA(user);
    expect(screen.getByText('Workout A')).toBeInTheDocument();
    expect(screen.getByText('Exercise 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('3 × 12–15 reps')).toBeInTheDocument();
    expect(screen.getByText('Bodyweight')).toBeInTheDocument();
    expect(screen.getByText('No earlier log')).toBeInTheDocument();
    expect(screen.getByText(/No demonstration bundled/)).toBeInTheDocument();
    expect(screen.getByText(/Next/).closest('p')).toHaveTextContent('Barbell incline bench press');
  });

  it('logs an individual set, edits it, and marks the round done', async () => {
    const { user } = renderApp();
    await startWorkoutA(user);
    await user.click(screen.getByRole('button', { name: 'Decrease Reps by 1' }));
    await user.click(screen.getByRole('button', { name: /Log set/ }));
    const row = await screen.findByText('Set 1');
    expect(row.closest('li')).toHaveTextContent('14');
    expect(screen.getByText('Done', { selector: '.tag' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit set 1' }));
    await user.click(screen.getByRole('button', { name: 'Increase Reps by 1' }));
    await user.click(screen.getByRole('button', { name: /Save set/ }));
    expect((await screen.findByText('Set 1')).closest('li')).toHaveTextContent('15');
  });

  it('quick complete asks before logging prescribed values, then advances', async () => {
    const { user } = renderApp();
    await startWorkoutA(user);
    await user.click(screen.getByRole('button', { name: 'Next exercise' }));
    await screen.findByRole('heading', { level: 1, name: 'Barbell incline bench press' });
    expect(screen.getByText('75 lb')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Complete/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Complete without logged sets?' });
    expect(dialog).toHaveTextContent('75 lb × 12 reps');
    await user.click(within(dialog).getByRole('button', { name: 'Log as prescribed' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Leg extensions' })).toBeInTheDocument();
  });

  it('substitutes for this session only', async () => {
    const { user } = renderApp();
    await startWorkoutA(user);
    await user.click(screen.getByRole('button', { name: 'Next exercise' }));
    await user.click(await screen.findByRole('button', { name: /Substitute/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Dumbbell incline press/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dumbbell incline press' })).toBeInTheDocument();
    expect(screen.getByText('Substituted')).toBeInTheDocument();
  });

  it('confirms before ending with unlogged exercises and saves to history', async () => {
    const { user } = renderApp();
    await startWorkoutA(user);
    await user.click(screen.getByRole('button', { name: 'End workout' }));
    const dialog = await screen.findByRole('dialog', { name: 'End workout?' });
    expect(dialog).toHaveTextContent(/27\s*of 27 exercise rounds aren't logged/);
    await user.click(within(dialog).getByRole('button', { name: 'Finish and save' }));
    expect(await screen.findByText('Workout complete')).toBeInTheDocument();
    expect(screen.getByText('Skipped').closest('div')).toHaveTextContent('0');
  });

  it('resumes an unfinished session after the app reloads', async () => {
    const name = dbName();
    const first = renderApp(name);
    await startWorkoutA(first.user);
    await first.user.click(screen.getByRole('button', { name: 'Next exercise' }));
    await screen.findByRole('heading', { level: 1, name: 'Barbell incline bench press' });
    first.unmount();
    navigate('/');

    const second = renderApp(name);
    await second.user.click(await screen.findByRole('link', { name: 'Continue workout' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Barbell incline bench press' })).toBeInTheDocument();
  });

  it('pauses and resumes', async () => {
    const { user } = renderApp();
    await startWorkoutA(user);
    await user.click(screen.getByRole('button', { name: 'Pause workout' }));
    expect(await screen.findByText('Paused')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Resume/ })[0]!);
    await waitFor(() => expect(screen.queryByText('Paused')).not.toBeInTheDocument());
  });
});

describe('Library and exercise detail', () => {
  it('searches and opens a detail page with caution and usage', async () => {
    const { user } = renderApp();
    await screen.findByText('Next in rotation');
    navigate('/library');
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), 'face');
    await user.click(screen.getByRole('link', { name: /Cable face pulls/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Cable face pulls' })).toBeInTheDocument();
    expect(screen.getByText(/neck and shoulder symptoms/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Workout A, block 2' })).toBeInTheDocument();
    expect(screen.getByText(/not medical clearance/)).toBeInTheDocument();
  });

  it('creates a custom exercise and rejects a duplicate name', async () => {
    const { user } = renderApp();
    await screen.findByText('Next in rotation');
    navigate('/library/new');
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.type(name, 'Leg Curl');
    await user.click(screen.getByRole('button', { name: 'Create exercise' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/You already have/);
    await user.clear(name);
    await user.type(name, 'Landmine press');
    await user.click(screen.getByRole('button', { name: 'Create exercise' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Landmine press' })).toBeInTheDocument();
  });
});

describe('Recovery', () => {
  it('is separate, carries the disclaimer, and logs a run', async () => {
    const { user } = renderApp();
    await screen.findByText('Next in rotation');
    navigate('/recovery');
    expect(await screen.findByText(/Not a diagnosis or a rehab programme/)).toBeInTheDocument();
    expect(screen.getByText('Gentle arm circles')).toBeInTheDocument();
    expect(screen.getByText('10 of 10 movements available · not done yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start routine' }));
    await user.click(screen.getAllByRole('button', { name: /Done/ })[0]!);
    await user.click(screen.getByRole('button', { name: /Finish now/ }));
    expect(await screen.findByText(/last done/)).toBeInTheDocument();
  });
});

describe('Settings', () => {
  it('rejects an invalid import with a clear message', async () => {
    const { user } = renderApp();
    await screen.findByText('Next in rotation');
    navigate('/settings');
    const input = await screen.findByLabelText('Restore from a backup file');
    await user.upload(input, new File(['{"app":"Other"}'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is not a REP backup.');
  });

  it('exports a backup and previews it for import', async () => {
    const created: Blob[] = [];
    const spy = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      created.push(b as Blob);
      return 'blob:x';
    });
    const { user } = renderApp();
    await screen.findByText('Next in rotation');
    navigate('/settings');
    await user.click(await screen.findByRole('button', { name: /Download backup/ }));
    expect(await screen.findByText(/Backup file created/)).toBeInTheDocument();
    const text = await readText(created[0]!);
    expect(JSON.parse(text)).toMatchObject({ app: 'REP', schemaVersion: 1 });

    await user.upload(screen.getByLabelText('Restore from a backup file'), new File([text], 'b.json', { type: 'application/json' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restore this backup?' });
    await user.click(within(dialog).getByRole('button', { name: 'Merge' }));
    expect(await screen.findByText(/Merged: 0 records added/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('switches to kilograms without changing stored weights', async () => {
    const { user } = renderApp();
    await screen.findByText('Next in rotation');
    navigate('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Kilograms (kg)' }));
    navigate('/workouts/workout-a');
    expect(await screen.findByText(/34 kg/)).toBeInTheDocument();
  });
});
