'use client';
import { FormEvent,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api,getError } from '@/lib/api';
export default function LoginPage(){const router=useRouter();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);
async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{const res=await api.post('/api/auth/login',{email,password});localStorage.setItem('token',res.data.token);router.push('/dashboard');}catch(err){setError(getError(err));}finally{setLoading(false);}}
return <main className="shell"><form className="card auth" onSubmit={submit}><div className="brand">Signora</div><h1>Welcome back</h1><p className="muted">Login to continue to your documents.</p>{error&&<p className="error">{error}</p>}<div className="field"><label>Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></div><div className="field"><label>Password</label><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></div><button className="btn" disabled={loading} style={{width:'100%'}}>{loading?'Logging in...':'Login'}</button><p className="muted">No account? <Link href="/register">Create one</Link></p></form></main>}
