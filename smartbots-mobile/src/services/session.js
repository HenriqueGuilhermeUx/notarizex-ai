import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY='sb_mobile_session';
export async function saveSession(s){await AsyncStorage.setItem(KEY,JSON.stringify(s||{}));}
export async function loadSession(){try{return JSON.parse(await AsyncStorage.getItem(KEY)||'{}')}catch(e){return {}}}
export async function clearSession(){await AsyncStorage.removeItem(KEY)}
export function hasSession(s){return !!(s&&s.botId&&s.clientToken)}