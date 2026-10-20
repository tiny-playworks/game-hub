export const arcadeGuides: Record<
  string,
  { goal: string; controls: string; tip: string }
> = {
  'guess-number': { goal: 'guess', controls: 'guess', tip: 'guess' },
  tictactoe: { goal: 'tictactoe', controls: 'place', tip: 'tictactoe' },
  memory: { goal: 'memory', controls: 'flip', tip: 'memory' },
  '2048': { goal: '2048', controls: 'slide', tip: '2048' },
  snake: { goal: 'snake', controls: 'steer', tip: 'snake' },
  breakout: { goal: 'breakout', controls: 'paddle', tip: 'breakout' },
  shooter: { goal: 'shooter', controls: 'shoot', tip: 'shooter' },
  tank: { goal: 'tank', controls: 'tank', tip: 'tank' },
  tetris: { goal: 'tetris', controls: 'tetris', tip: 'tetris' },
  rubiks: { goal: 'rubiks', controls: 'rubiks', tip: 'rubiks' },
  go: { goal: 'go', controls: 'place', tip: 'go' },
  gomoku: { goal: 'gomoku', controls: 'place', tip: 'gomoku' },
  xiangqi: { goal: 'xiangqi', controls: 'piece', tip: 'xiangqi' },
  chess: { goal: 'chess', controls: 'piece', tip: 'chess' },
  doudizhu: { goal: 'doudizhu', controls: 'cards', tip: 'doudizhu' },
  shengji: { goal: 'shengji', controls: 'cards', tip: 'shengji' },
};
