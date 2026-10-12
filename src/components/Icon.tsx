import type { SVGProps } from 'react';

const PATHS = {
  home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z',
  workouts: 'M3 9h2v6H3zM19 9h2v6h-2zM6 7h3v10H6zM15 7h3v10h-3zM9 11h6v2H9z',
  history: 'M12 4a8 8 0 1 1-7.4 5M4 4v5h5M12 8v4l3 2',
  library: 'M4 5h6v14H4zM14 5h6v14h-6zM6 8h2M16 8h2',
  recovery: 'M3 15c3-6 6 2 9-4s6 2 9-4M3 20h18',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  check: 'M4 12.5l5 5L20 6',
  skip: 'M5 5l9 7-9 7zM17 5v14',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  play: 'M7 4l13 8-13 8z',
  close: 'M5 5l14 14M19 5 5 19',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'M12 5l-7 7M12 5l7 7M12 5v14',
  down: 'M12 19l-7-7M12 19l7-7M12 5v14',
  alert: 'M12 3 2 20h20zM12 10v4M12 17v.5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  upload: 'M12 20V9M7 14l5-5 5 5M4 4h16',
  flag: 'M5 21V4h12l-2 4 2 4H5',
  share: 'M12 3v12M8 7l4-4 4 4M5 11v9h14v-9',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, title, ...rest }: { name: IconName; size?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
