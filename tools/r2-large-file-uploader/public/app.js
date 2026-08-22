import { R2MultipartUploader } from './uploader.js';

const serviceState = document.querySelector('#service-state');
const configSection = document.querySelector('#config-section');
const configForm = document.querySelector('#config-form');
const configFields = document.querySelector('#config-fields');
const configStatus = document.querySelector('#config-status');
const tokenSection = document.querySelector('#token-section');
const tokenForm = document.querySelector('#token-form');
const tokenFields = document.querySelector('#token-fields');
const tokenInput = document.querySelector('#token-input');
const tokenStatus = document.querySelector('#token-status');
const accountIdInput = document.querySelector('#account-id');
const bucketNameInput = document.querySelector('#bucket-name');
const accessKeyIdInput = document.querySelector('#access-key-id');
const secretAccessKeyInput = document.querySelector('#secret-access-key');
const publicBaseUrlInput = document.querySelector('#public-base-url');
const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const filePanel = document.querySelector('#file-panel');
const fileName = document.querySelector('#file-name');
const fileSize = document.querySelector('#file-size');
const startButton = document.querySelector('#start-upload');
const cancelButton = document.querySelector('#cancel-upload');
const progressPanel = document.querySelector('#progress-panel');
const progressBar = document.querySelector('#progress-bar');
const progressPercent = document.querySelector('#progress-percent');
const progressBytes = document.querySelector('#progress-bytes');
const progressSpeed = document.querySelector('#progress-speed');
const progressRemaining = document.querySelector('#progress-remaining');
const phaseText = document.querySelector('#phase-text');
const resultPanel = document.querySelector('#result-panel');
const resultKey = document.querySelector('#result-key');
const resultUrl = document.querySelector('#result-url');
const downloadLink = document.querySelector('#download-link');
const copyButton = document.querySelector('#copy-url');
const message = document.querySelector('#message');

let selectedFile = null;
let uploading = false;
let storageReady = false;
let uploadStartedAt = 0;
let pendingProgress = null;
let progressFrame = 0;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: unitIndex ? 1 : 0 })} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)} 秒`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function showMessage(text, kind = 'info') {
  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = !text;
}

function setServiceState(text, state) {
  serviceState.lastChild.textContent = text;
  serviceState.dataset.state = state;
}

function setStorageReady(ready) {
  storageReady = ready;
  fileInput.disabled = uploading || !ready;
  dropZone.setAttribute('aria-disabled', String(uploading || !ready));
  startButton.disabled = uploading || !ready || !selectedFile || selectedFile.size <= 0;
}

function renderLocalConfig(config) {
  configSection.hidden = false;
  accountIdInput.value = config.accountId || '';
  bucketNameInput.value = config.bucketName || '';
  accessKeyIdInput.value = config.accessKeyId || '';
  publicBaseUrlInput.value = config.publicBaseUrl || '';
  secretAccessKeyInput.value = '';
  secretAccessKeyInput.required = !config.configured;
  secretAccessKeyInput.placeholder = config.configured ? '留空则保留现有密钥' : '';
  configStatus.textContent = config.configured
    ? `已连接存储桶 ${config.bucketName}`
    : '请填写 R2 API 凭据后保存。';
  configStatus.dataset.kind = config.configured ? 'success' : 'info';
  setServiceState(config.configured ? 'R2 已连接' : '等待 R2 配置', config.configured ? 'ready' : 'pending');
  setStorageReady(Boolean(config.configured));
}

async function readApiResponse(response) {
  const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

async function loadConfiguration() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (response.status === 404) {
      configSection.hidden = true;
      tokenSection.hidden = false;
      tokenInput.value = localStorage.getItem('r2-upload-token') || '';
      renderTokenStatus(Boolean(localStorage.getItem('r2-upload-token')));
      setServiceState('Worker 直连 R2', 'ready');
      setStorageReady(true);
      return;
    }
    renderLocalConfig(await readApiResponse(response));
  } catch (error) {
    configSection.hidden = false;
    configStatus.textContent = `无法读取 R2 配置：${error.message}`;
    configStatus.dataset.kind = 'error';
    setServiceState('R2 连接失败', 'error');
    setStorageReady(false);
  }
}

function renderTokenStatus(saved) {
  tokenStatus.textContent = saved ? '已保存令牌，上传时会自动携带。' : '未填写令牌；仅当服务器启用校验时需要。';
  tokenStatus.dataset.kind = saved ? 'success' : 'info';
}

tokenForm.addEventListener('submit', event => {
  event.preventDefault();
  const value = tokenInput.value.trim();
  if (value) localStorage.setItem('r2-upload-token', value);
  else localStorage.removeItem('r2-upload-token');
  renderTokenStatus(Boolean(value));
});

function renderProgress(loaded, total) {
  const percent = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
  const elapsedSeconds = Math.max((performance.now() - uploadStartedAt) / 1000, 0.001);
  const speed = loaded / elapsedSeconds;
  const remaining = speed > 0 ? (total - loaded) / speed : Number.NaN;

  progressBar.style.setProperty('--progress-width', `${percent}%`);
  progressBar.setAttribute('aria-valuenow', percent.toFixed(1));
  progressPercent.textContent = `${percent.toFixed(percent < 10 ? 1 : 0)}%`;
  progressBytes.textContent = `${formatBytes(loaded)} / ${formatBytes(total)}`;
  progressSpeed.textContent = speed > 0 ? `${formatBytes(speed)}/s` : '--';
  progressRemaining.textContent = percent >= 100 ? '正在合并' : formatDuration(remaining);
}

function scheduleProgress(loaded, total) {
  pendingProgress = { loaded, total };
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(() => {
    progressFrame = 0;
    if (pendingProgress) renderProgress(pendingProgress.loaded, pendingProgress.total);
  });
}

const uploader = new R2MultipartUploader({
  concurrency: 3,
  token: () => localStorage.getItem('r2-upload-token') || '',
  onProgress: scheduleProgress,
  onPhase: text => { phaseText.textContent = text; },
});

function selectFile(file) {
  if (uploading || !storageReady || !file) return;
  selectedFile = file;
  fileName.textContent = file.name;
  fileName.title = file.name;
  fileSize.textContent = `${formatBytes(file.size)} · ${file.type || '未知类型'}`;
  filePanel.hidden = false;
  startButton.disabled = file.size <= 0 || !storageReady;
  resultPanel.hidden = true;
  showMessage(file.size > 0 ? '文件已就绪。' : '不能上传空文件。', file.size > 0 ? 'info' : 'error');
}

fileInput.addEventListener('change', () => selectFile(fileInput.files?.[0]));
dropZone.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && !uploading && storageReady) {
    event.preventDefault();
    fileInput.click();
  }
});
for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    if (!uploading && storageReady) dropZone.dataset.dragging = 'true';
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    delete dropZone.dataset.dragging;
  });
}
dropZone.addEventListener('drop', event => selectFile(event.dataTransfer?.files?.[0]));

configForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (uploading) return;
  const wasReady = storageReady;
  configFields.disabled = true;
  configStatus.textContent = '正在验证 R2 凭据...';
  configStatus.dataset.kind = 'info';
  setServiceState('正在验证 R2', 'checking');
  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accountId: accountIdInput.value,
        bucketName: bucketNameInput.value,
        accessKeyId: accessKeyIdInput.value,
        secretAccessKey: secretAccessKeyInput.value,
        publicBaseUrl: publicBaseUrlInput.value,
      }),
    });
    renderLocalConfig(await readApiResponse(response));
  } catch (error) {
    configStatus.textContent = error.message;
    configStatus.dataset.kind = 'error';
    setServiceState(wasReady ? 'R2 已连接' : 'R2 验证失败', wasReady ? 'ready' : 'error');
    setStorageReady(wasReady);
  } finally {
    configFields.disabled = false;
  }
});

startButton.addEventListener('click', async () => {
  if (!selectedFile || uploading || !storageReady) return;
  uploading = true;
  uploadStartedAt = performance.now();
  startButton.disabled = true;
  cancelButton.hidden = false;
  configFields.disabled = true;
  tokenFields.disabled = true;
  setStorageReady(true);
  progressPanel.hidden = false;
  resultPanel.hidden = true;
  scheduleProgress(0, selectedFile.size);
  showMessage('');

  try {
    const result = await uploader.upload(selectedFile);
    if (progressFrame) cancelAnimationFrame(progressFrame);
    progressFrame = 0;
    pendingProgress = null;
    renderProgress(selectedFile.size, selectedFile.size);
    phaseText.textContent = '上传完成';
    progressRemaining.textContent = '已完成';
    const preferredDownloadUrl = result.publicDownloadUrl || result.downloadUrl;
    resultKey.textContent = `R2 对象：${result.key}`;
    resultUrl.value = preferredDownloadUrl;
    downloadLink.href = preferredDownloadUrl;
    resultPanel.hidden = false;
    showMessage('文件已写入 R2，下载地址已生成。', 'success');

    const detail = Object.freeze({ ...result, file: selectedFile });
    window.dispatchEvent(new CustomEvent('r2-upload-complete', { detail }));
    if (typeof window.onR2UploadComplete === 'function') {
      window.onR2UploadComplete(detail);
    }
  } catch (error) {
    const cancelled = error?.name === 'UploadCancelledError';
    phaseText.textContent = cancelled ? '上传已取消' : '上传失败';
    showMessage(cancelled ? '上传已取消，可重新开始。' : `${error.message} 请检查网络后重试。`, cancelled ? 'info' : 'error');
  } finally {
    uploading = false;
    configFields.disabled = false;
    tokenFields.disabled = false;
    cancelButton.hidden = true;
    setStorageReady(storageReady);
  }
});

cancelButton.addEventListener('click', async () => {
  cancelButton.disabled = true;
  phaseText.textContent = '正在取消...';
  await uploader.cancel();
  cancelButton.disabled = false;
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultUrl.value);
  } catch {
    resultUrl.select();
    document.execCommand('copy');
  }
  showMessage('下载地址已复制。', 'success');
});

window.addEventListener('beforeunload', event => {
  if (!uploading) return;
  event.preventDefault();
  event.returnValue = '';
});

await loadConfiguration();
