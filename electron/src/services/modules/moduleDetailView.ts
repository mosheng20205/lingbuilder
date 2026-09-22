/**
 * 模块详情页签事件总线：模块列表（侧栏）与模块详情页（主区页签）是兄弟组件，
 * 通过 window CustomEvent 通信，与 lingbuilder-modules-changed 同一套模式。
 * 动作执行权保留在 ModuleInspector（启停/购买/修复等流程与收费门禁单一出口），
 * 详情页只发出动作请求，不直接调用模块 API。
 */

export const MODULE_DETAIL_OPEN_EVENT = 'lingbuilder-open-module-detail';
export const MODULE_DETAIL_ACTION_EVENT = 'lingbuilder-module-detail-action';
export const MODULE_PAGE_ACTIVE_EVENT = 'lingbuilder-module-page-active';

export interface ModuleDetailActionRequest {
  type: 'toggle' | 'uninstall' | 'unlink' | 'repair' | 'download' | 'purchase';
  moduleId: string;
  provider?: 'wechat' | 'alipay';
}

export function openModuleDetailView(moduleId: string): void {
  window.dispatchEvent(new CustomEvent(MODULE_DETAIL_OPEN_EVENT, { detail: { moduleId } }));
}

export function requestModuleDetailAction(request: ModuleDetailActionRequest): void {
  window.dispatchEvent(new CustomEvent(MODULE_DETAIL_ACTION_EVENT, { detail: request }));
}

/** 模块侧栏页激活时通知主区：浏览模块列表期间主区隐藏编辑器/设计器，显示占位页（详情页签打开除外）。 */
export function setModulePageActive(active: boolean): void {
  window.dispatchEvent(new CustomEvent(MODULE_PAGE_ACTIVE_EVENT, { detail: { active } }));
}
