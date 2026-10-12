import axiosInstance from './axiosInstance'

export const login = async (credentials) => {
	const { data } = await axiosInstance.post('/auth/login', credentials, { withCredentials: true })
	return data
}

export const loginWithGoogle = async (idToken) => {
	const { data } = await axiosInstance.post('/auth/google', { idToken }, { withCredentials: true })
	return data
}

export const signup = async (credentials) => {
	const { data } = await axiosInstance.post('/auth/register', credentials, { withCredentials: true })
	return data
}

export const getUser = async () => {
	const { data } = await axiosInstance.get('/auth/profile', { withCredentials: true })
	return data
}

export const logout = async () => {
	const { data } = await axiosInstance.post('/auth/logout', undefined, { withCredentials: true })
	return data
}
export { axiosInstance }