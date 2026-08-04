import React from 'react';
import {ScrollView} from 'react-native';
import * as Linking from 'expo-linking';
import {Screen,H1,Muted,Row,Button} from '../components';
import {clearSession} from '../services/session';
import {apiBase} from '../theme';
export default function MoreScreen({session,onLogout,navigation}){async function logout(){await clearSession();onLogout()}return <Screen><ScrollView><H1>Mais</H1><Muted>Configurações e atalhos.</Muted><Row title="Agenda Pro" subtitle="Link de agendamento" onPress={()=>navigation.navigate('Agenda')}/><Row title="Meu Bot" subtitle="Mini site, bio e QR" onPress={()=>navigation.navigate('Bot')}/><Row title="Painel Web" subtitle="Abrir smartbots.club" onPress={()=>Linking.openURL(apiBase+'/operacao.html')}/><Row title="Ensinar Bot" subtitle="Base de conhecimento" onPress={()=>Linking.openURL(apiBase+'/conhecimento.html')}/><Row title="Indicadores" subtitle="Relatórios simples" onPress={()=>Linking.openURL(apiBase+'/indicadores.html')}/><Button secondary onPress={logout}>Sair</Button></ScrollView></Screen>}