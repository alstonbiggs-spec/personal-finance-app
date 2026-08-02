'use client';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
export default function LoginPage() {
  const [error, setError] = useState('');
  const router = useRouter();
  async function onSubmit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setError(''); const form=new FormData(e.currentTarget); const {error}=await createClient().auth.signInWithPassword({email:String(form.get('email')),password:String(form.get('password'))}); if(error){setError(error.message);return} router.push('/budget'); router.refresh(); }
  return <main className="flex min-h-screen items-center justify-center px-6"><section className="w-full max-w-md"><p className="label mb-5">Private household office</p><h1 className="serif text-5xl leading-none">Welcome back.</h1><p className="mt-5 text-sm leading-6 text-ink/60">A quiet place to see the whole picture.</p><form onSubmit={onSubmit} className="mt-12 space-y-5"><label className="block"><span className="label">Email</span><input name="email" type="email" required className="mt-2 w-full border-b hairline bg-transparent px-0 py-3 outline-none focus:border-forest" /></label><label className="block"><span className="label">Password</span><input name="password" type="password" required className="mt-2 w-full border-b hairline bg-transparent px-0 py-3 outline-none focus:border-forest" /></label>{error && <p className="text-sm text-red-700">{error}</p>}<button className="button-primary mt-3 w-full">Sign in</button></form></section></main>;
}
