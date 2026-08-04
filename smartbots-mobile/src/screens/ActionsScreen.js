import React,{useCallback,useState}from 'react';
import {ScrollView,RefreshControl} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import {Screen,H1,Muted,Row,Button,Card} from '../components';
import {events} from '../services/api';
import {openWhatsApp} from '../services/whatsapp';
export default function ActionsScreen({session}){const[list,setList]=useState([]);const[loading,setLoading]=useState(false);const load=async()=>{setLoading(true);const j=await events(session);setList(j.items||j.events||[]);setLoading(false)};useFocusEffect(useCallback(()=>{load()},[]));async function copy(m){await Clipboard.setStringAsync(m||'')}return <Screen><ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/> }><H1>Ações</H1><Muted>Agenda, vendas, dúvidas, retorno e atendimento humano.</Muted>{list.slice(0,30).map((x,i)=>{const p=x.payload||{};const msg=p.message||p.title||x.event_type||'Ação SmartBots';return <Card key={i}><Row title={p.title||x.event_type||'Ação'} subtitle={msg} right={x.status||'pendente'}/><Button onPress={()=>copy(msg)}>Copiar mensagem</Button><Button secondary onPress={()=>openWhatsApp(p.phone,msg)}>Abrir WhatsApp</Button></Card>})}{!list.length?<Row title="Nenhuma ação" subtitle="As próximas ações criadas pelo bot aparecerão aqui."/>:null}</ScrollView></Screen>}