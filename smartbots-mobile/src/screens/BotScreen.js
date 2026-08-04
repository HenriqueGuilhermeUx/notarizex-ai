import React from 'react';
import {ScrollView} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import {Screen,H1,Muted,Card,Button,Row} from '../components';
import {apiBase} from '../theme';
export default function BotScreen({session}){const link=apiBase+'/b/'+session.botId;async function copy(){await Clipboard.setStringAsync(link)}return <Screen><ScrollView><H1>Meu Bot</H1><Muted>Link inteligente para bio, QR Code, anúncios e WhatsApp.</Muted><Card><Row title="Mini site SmartBots" subtitle={link}/><Button onPress={copy}>Copiar link</Button><Button secondary onPress={()=>Linking.openURL(link)}>Testar bot</Button></Card><Row title="Coloque na bio do Instagram" subtitle="Use o link como recepção digital."/><Row title="Use em QR Code" subtitle="Divulgue em balcão, cartão, panfleto ou anúncio."/><Row title="Ensine o bot pelo painel web" subtitle="Serviços, horários, preços e perguntas frequentes."/></ScrollView></Screen>}