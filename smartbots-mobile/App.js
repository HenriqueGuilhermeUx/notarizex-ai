import React,{useEffect,useState}from 'react';
import {ActivityIndicator,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {NavigationContainer,DarkTheme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {colors} from './src/theme';
import {loadSession,hasSession} from './src/services/session';
import LoginScreen from './src/screens/LoginScreen';
import TodayScreen from './src/screens/TodayScreen';
import CrmScreen from './src/screens/CrmScreen';
import ActionsScreen from './src/screens/ActionsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ProspectingScreen from './src/screens/ProspectingScreen';
import AgendaScreen from './src/screens/AgendaScreen';
import BotScreen from './src/screens/BotScreen';
import MoreScreen from './src/screens/MoreScreen';
const Tab=createBottomTabNavigator();const Stack=createNativeStackNavigator();
function Tabs({session,onLogout}){return <Tab.Navigator screenOptions={({route})=>({headerShown:false,tabBarStyle:{backgroundColor:colors.card,borderTopColor:colors.line,height:66},tabBarActiveTintColor:colors.green,tabBarInactiveTintColor:colors.muted,tabBarLabelStyle:{fontSize:11,fontWeight:'700'},tabBarIcon:({color,size})=>{const m={Hoje:'today',CRM:'briefcase',Ações:'checkmark-done',Mensagens:'chatbubble-ellipses',Prospecção:'search',Mais:'menu'};return <Ionicons name={m[route.name]||'ellipse'} size={size} color={color}/>}})}><Tab.Screen name="Hoje">{p=><TodayScreen {...p} session={session}/>}</Tab.Screen><Tab.Screen name="CRM">{p=><CrmScreen {...p} session={session}/>}</Tab.Screen><Tab.Screen name="Ações">{p=><ActionsScreen {...p} session={session}/>}</Tab.Screen><Tab.Screen name="Mensagens" component={MessagesScreen}/><Tab.Screen name="Prospecção">{p=><ProspectingScreen {...p} session={session}/>}</Tab.Screen><Tab.Screen name="Mais">{p=><MoreScreen {...p} session={session} onLogout={onLogout}/>}</Tab.Screen></Tab.Navigator>}
function Main({session,onLogout}){return <Stack.Navigator screenOptions={{headerStyle:{backgroundColor:colors.bg},headerTintColor:colors.text,contentStyle:{backgroundColor:colors.bg}}}><Stack.Screen name="App" options={{headerShown:false}}>{p=><Tabs {...p} session={session} onLogout={onLogout}/>}</Stack.Screen><Stack.Screen name="Agenda">{p=><AgendaScreen {...p} session={session}/>}</Stack.Screen><Stack.Screen name="Bot">{p=><BotScreen {...p} session={session}/>}</Stack.Screen></Stack.Navigator>}
export default function App(){const[loading,setLoading]=useState(true);const[session,setSession]=useState(null);useEffect(()=>{loadSession().then(s=>{setSession(hasSession(s)?s:null);setLoading(false)})},[]);if(loading)return <View style={{flex:1,backgroundColor:colors.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={colors.green}/></View>;return <NavigationContainer theme={DarkTheme}><StatusBar style="light"/>{session?<Main session={session} onLogout={()=>setSession(null)}/>:<LoginScreen onLogin={setSession}/>}</NavigationContainer>}