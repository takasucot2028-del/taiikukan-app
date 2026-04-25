const CLUB_COLORS: Record<string, { bg: string; text: string }> = {
  '野球部':           { bg: 'bg-blue-100',   text: 'text-blue-800'   },
  '女子バレー部':     { bg: 'bg-pink-100',   text: 'text-pink-800'   },
  'バドミントン部':   { bg: 'bg-green-100',  text: 'text-green-800'  },
  'REDWOLVES男子':   { bg: 'bg-red-100',    text: 'text-red-800'    },
  'REDWOLVES女子':   { bg: 'bg-orange-100', text: 'text-orange-800' },
  '男子バレー':       { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  '男女バレーボール': { bg: 'bg-purple-100', text: 'text-purple-800' },
  'ソフトテニス':     { bg: 'bg-lime-100',   text: 'text-lime-800'   },
  '剣道':            { bg: 'bg-amber-100',  text: 'text-amber-800'  },
  'NexusBC':         { bg: 'bg-cyan-100',   text: 'text-cyan-800'   },
}

const DEFAULT_COLOR = { bg: 'bg-gray-100', text: 'text-gray-800' }

export function getClubColor(clubName: string): { bg: string; text: string } {
  return CLUB_COLORS[clubName] ?? DEFAULT_COLOR
}
