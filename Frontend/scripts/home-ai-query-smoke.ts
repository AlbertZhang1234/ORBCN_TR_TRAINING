import { query } from '../lib/db';
import { derivePermissionFlags } from '../services/_core/roles';
import { getLlmConfig, runOttoNaturalLanguageQuery, type OttoAuthContext } from '../app/api/home/ai-query/ottoVTrAllTool';

interface SmokeCase {
  question: string;
  expectData?: boolean;
  expectGroup?: boolean;
}

const CASES: SmokeCase[] = [
  { question: '本月我的报销总额是多少？', expectData: true },
  { question: '这个月我的税额一共多少？', expectData: true },
  { question: '这个月我的未税金额是多少？', expectData: true },
  { question: '列出最近 5 条我的报销明细', expectData: true },
  { question: '列出最近 5 张发票', expectData: true },
  { question: '谁的报销金额最高？', expectData: true, expectGroup: true },
  { question: '按申请人统计金额排行', expectData: true, expectGroup: true },
  { question: '按项目统计金额排行', expectData: true, expectGroup: true },
  { question: '按客户统计金额排行', expectData: true, expectGroup: true },
  { question: '按供应商统计金额排行', expectData: true, expectGroup: true },
  { question: '按 booking code 统计金额', expectData: true, expectGroup: true },
  { question: '列出本月 Wait for Approval 的记录', expectData: true },
  { question: '列出已记账的发票', expectData: true },
  { question: '列出发票状态是 SUBMITTED 的记录', expectData: true },
  { question: 'NSI 客户相关的记录有哪些？', expectData: true },
  { question: '耐驰上海支持项目的金额是多少？', expectData: true },
  { question: 'Ruiyang Shen 相关的记录有哪些？', expectData: true },
  { question: '列出 booking code 是 AUTG 的记录', expectData: true },
  { question: '本月谁的报销金额最高？', expectData: true, expectGroup: true },
  { question: '按目的地统计金额', expectData: false, expectGroup: true },
];

async function buildAuthContext(userid: string): Promise<OttoAuthContext> {
  const roleRows = await query<{ roleid?: string }>(
    'SELECT roleid FROM "otto_userrole" WHERE userid = $1',
    [userid],
  );
  const roleIds = roleRows.map((row) => String(row.roleid ?? '').trim()).filter(Boolean);
  const permissions = derivePermissionFlags(roleIds);
  return {
    requesterUserId: userid,
    requestUserId: userid,
    roleids: roleIds,
    permissions,
    canViewAll: permissions.isAdmin || permissions.isFinance,
  };
}

async function main() {
  const userid = process.env.AI_QUERY_SMOKE_USER || 'shenruiyang';
  const auth = await buildAuthContext(userid);
  const llm = getLlmConfig();
  const failures: string[] = [];

  console.log(`Running ${CASES.length} home AI smoke cases as ${userid} using model=${llm?.model ?? 'fallback'}`);

  for (let index = 0; index < CASES.length; index += 1) {
    const testCase = CASES[index];
    const startedAt = Date.now();
    const response = await runOttoNaturalLanguageQuery(testCase.question, auth, llm);
    const elapsed = Date.now() - startedAt;
    const rowCount = response.result.aggregate.rowCount;
    const groupCount = response.result.groupedRows.length;
    const okData = testCase.expectData === undefined ? true : testCase.expectData ? rowCount > 0 : true;
    const okGroup = testCase.expectGroup ? groupCount > 0 || response.result.notes.length > 0 : true;
    const ok = okData && okGroup;

    console.log(
      JSON.stringify(
        {
          index: index + 1,
          ok,
          elapsedMs: elapsed,
          question: testCase.question,
          operation: response.plan.operation,
          metric: response.plan.metric,
          groupBy: response.plan.groupBy,
          searchTerms: response.plan.searchTerms,
          filters: response.plan.filters,
          rowCount,
          groupCount,
          notes: response.result.notes,
        },
        null,
        2,
      ),
    );

    if (!ok) {
      failures.push(`${index + 1}. ${testCase.question}`);
    }
  }

  if (failures.length > 0) {
    console.error(`Smoke failures (${failures.length}):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('All smoke cases passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
