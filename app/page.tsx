import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function RootPage() {
  let user = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch (error) {
    console.error("Erro ao obter usuário no RootPage:", error);
  }

  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
