import { http } from './http.js';

export const createRecord = (subtaskId, payload) => http.post(`/subtasks/${subtaskId}/records`, payload);
export const updateRecord = (recordId, payload) => http.put(`/records/${recordId}`, payload);
export const deleteRecord = (recordId) => http.del(`/records/${recordId}`);
