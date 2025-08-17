import { http } from './http.js';

export const listTasks = () => http.get('/tasks');
export const getTask = (id) => http.get(`/tasks/${id}`);
export const createTask = (payload) => http.post('/tasks', payload);
export const updateTask = (id, payload) => http.put(`/tasks/${id}`, payload);
export const deleteTask = (id) => http.del(`/tasks/${id}`);
