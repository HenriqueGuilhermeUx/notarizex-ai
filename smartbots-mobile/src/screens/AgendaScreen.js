import React,{useState,useCallback}from 'react';
import {ScrollView,TextInput,StyleSheet} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import * as Linking from 'expo-linking';
import {Screen,H1,Muted,Card,Button} from '../components';
import {colors} from '../theme';
import {agendaGet,agendaSave} from '../services/api';
export default function AgendaScreen({session}){const[url,setUrl]=useState('');const[status,setStatus]=useState('');const load=async()=>{const j=await agendaGet(session);if(j.item) setUrl(j.item.booking_url||j.item.bookingUrl||'')};useFocusEffect(useCallback(()=>{load()},[]));async function save(){const j=await agendaSave(session,url);setStatus(j.success?'Agenda salva':(j.error||'Erro'))}return <Screen><ScrollView><H1>Agenda Pro</H1><Muted>Use Cal.com ou qualquer link externo de agenda.</Muted><Card><TextInput value={url} onChangeText={setUrl} placeholder="https://cal.com/seu-link" placeholderTextColor={colors.muted} autoCapitalize="none" style={st.input}/><Button onPress={save}>Salvar agenda</Button><Button secondary onPress={()=>url&&Linking.openURL(url)}>Abrir link</Button><Muted>{status}</Muted></Card><Muted>Quando salvo, o mini site pode mostrar o botão de agendamento para o cliente.</Muted></ScrollView></Screen>}
const st=StyleSheet.create({input:{backgroundColor:'#020617',borderColor:colors.line,borderWidth:1,borderRadius:14,padding:13,color:colors.text,marginBottom:10}});