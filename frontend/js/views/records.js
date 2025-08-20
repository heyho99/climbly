import { api } from '../api.js';

export async function RecordsView() {
  let data = { items: [] };
  try { data = await api.listRecords({ page:1, per_page:50 }); } catch {}
  const items = Array.isArray(data) ? data : (data.items || []);

  return `
  <div class="card">
    <h2>実績記録</h2>
    <table class="table">
      <thead><tr><th>タスク</th><th>開始</th><th>終了</th><th>進捗</th><th>作業時間</th></tr></thead>
      <tbody>
        ${items.map(r => `
          <tr>
            <td>${r.task_name || r.task_id}</td>
            <td>${r.start_at ? new Date(r.start_at).toLocaleString() : ''}</td>
            <td>${r.end_at ? new Date(r.end_at).toLocaleString() : ''}</td>
            <td>${r.progress_value ?? ''}</td>
            <td>${r.work_time ?? ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${!items.length ? '<div class="helper">記録がありません</div>' : ''}
  </div>`;
}
