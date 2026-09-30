import type { BeginnerFindResultEntry, BeginnerFindScope } from './beginnerFind';

/**
 * 新手画布查找「查找全部 / 跨文件搜索」的结果事件：
 * DiffViewer（查找条所在处）派发，App 监听后打开底部面板「查找结果」页签。
 */
export const LINGCPP_FIND_RESULTS_EVENT = 'lingcpp-find-results';

export interface FindResultsData {
  query: string;
  scope: BeginnerFindScope;
  results: BeginnerFindResultEntry[];
  truncated: boolean;
}
