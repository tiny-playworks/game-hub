import { openDatabase } from '../db';
import { getMember } from '../db';
import { isRankedGame, listTopEntries, setEntryHidden } from '../services/leaderboard';

const usage = '用法：leaderboard top <gameId> <difficulty> [all-time|week] [N] | ' +
  'hide <memberId> <roundId> "原因" | restore <memberId> <roundId>';

const db = openDatabase();
try {
  const [command, a, b, c, d] = process.argv.slice(2);
  if (command === 'top') {
    if (!a || !b || !isRankedGame(a)) throw new Error(usage);
    const scope = c === 'week' ? 'week' : 'all-time';
    const limit = Math.min(Math.max(1, Number(d ?? 10) || 10), 100);
    for (const row of listTopEntries(db, a, b, scope, limit))
      console.log(`${row.rank}\t${row.value}\t${row.memberId}\t${row.roundId}\t${
        row.occurredAt ? new Date(row.occurredAt).toISOString() : 'legacy'}`);
  } else if (command === 'hide') {
    if (!a || !b || !c?.trim() || !getMember(db, a)) throw new Error(usage);
    console.log(setEntryHidden(db, a, b, true, c.trim()) ? '已隐藏该成绩' : '未找到该成绩');
  } else if (command === 'restore') {
    if (!a || !b || !getMember(db, a)) throw new Error(usage);
    console.log(setEntryHidden(db, a, b, false, null) ? '已恢复该成绩' : '未找到该成绩');
  } else {
    throw new Error(usage);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : '操作失败');
  process.exitCode = 1;
} finally {
  db.close();
}
