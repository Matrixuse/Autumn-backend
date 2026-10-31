import axiosInstance from './axiosInstance'

const readAccountData = (response) => response.data?.data || {}

export const fetchAccountData = async () => readAccountData(await axiosInstance.get('/account/data'))

export const patchAccountData = async (changes) =>
  readAccountData(await axiosInstance.patch('/account/data', changes))

export const importAccountData = async (data) =>
  readAccountData(await axiosInstance.post('/account/data/import', data))
