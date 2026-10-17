import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/ModuleGlobal/supabase';

export async function GET(req: NextRequest) {
  try {
    const referenceid = req.nextUrl.searchParams.get('referenceid');

    if (!referenceid) {
      return NextResponse.json({ error: 'Missing referenceid parameter' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('Firstname, Lastname, signatureImage')
      .eq('ReferenceID', referenceid)
      .single();

    if (error) {
      console.error('Supabase error fetching user by ReferenceID:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const name = `${user.Firstname} ${user.Lastname}`.trim();
    return NextResponse.json({ name, signatureImage: user.signatureImage });
  } catch (error) {
    console.error('Server error in user-by-reference:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
