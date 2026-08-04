import * as Linking from 'expo-linking';
export function onlyDigits(v){return String(v||'').replace(/\D/g,'')}
export function buildMessage(name,reason){return `Oi ${name||''}, tudo bem? Passando para falar sobre ${reason||'seu atendimento'}. Posso te ajudar por aqui?`.trim()}
export async function openWhatsApp(phone,message){const p=onlyDigits(phone);const url=p?`https://wa.me/${p}?text=${encodeURIComponent(message||'')}`:`https://wa.me/?text=${encodeURIComponent(message||'')}`;return Linking.openURL(url)}