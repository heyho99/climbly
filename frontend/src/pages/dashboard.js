import { listTasks } from '../api/tasks.js';

export async function renderDashboard(root) {
  root.innerHTML = `<h1>ダッシュボード</h1><div id="tasks"></div><canvas id="chart" height="140"></canvas>`;
  try {
    const data = await listTasks();
    const tasksDiv = root.querySelector('#tasks');
    tasksDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;

    const ctx = root.querySelector('#chart');
    // 簡易チャート
    const labels = (data.tasks || []).map(t => t.task_name || `Task ${t.task_id}`);
    const values = (data.tasks || []).map(t => t.completion_rate || 0);
    new window.Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: '進捗(%)', data: values }] },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });
  } catch (e) {
    root.insertAdjacentHTML('beforeend', `<p>データ取得に失敗しました</p>`);
  }
}
