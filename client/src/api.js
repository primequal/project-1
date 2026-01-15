import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

API.interceptors.request.use((req) => {
    const token = localStorage.getItem('token');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

export const login = (formData) => API.post('/auth/login', formData);
export const register = (formData) => API.post('/auth/register', formData);
export const getMe = () => API.get('/auth/me');
export const updateAvatar = (avatarUrl) => API.put('/auth/avatar', { avatarUrl }); 

// HÀM MỚI: Upload file (Cần header multipart/form-data, axios tự xử lý khi nhận FormData)
export const uploadAvatarFile = (formData) => API.post('/auth/avatar-upload', formData);