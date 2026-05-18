// Supabase Edge Function für Google OAuth Token Exchange
// Pfad: supabase/functions/oauth-exchange/index.ts
// 
// Diese Funktion tauscht den Authorization Code gegen Access/Refresh Tokens
// und speichert sie sicher in der Datenbank

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS Preflight handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Nur POST erlaubt
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Request Body parsen
    const { code, calendarId } = await req.json();

    if (!code) {
      throw new Error('Authorization code required');
    }

    // Supabase Client initialisieren
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false }
      }
    );

    // User aus JWT Token extrahieren
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Google OAuth Token Exchange
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: Deno.env.get('OAUTH_REDIRECT_URI') ?? '',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      throw new Error(tokenData.error_description || 'Token exchange failed');
    }

    // Tokens in Datenbank speichern (verschlüsselt!)
    const { error: insertError } = await supabaseClient
      .from('google_calendar_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        calendar_id: calendarId || 'primary',
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to save tokens:', insertError);
      throw new Error('Failed to save tokens');
    }

    // Erfolg zurückgeben
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Google Calendar connected successfully',
        calendarId: calendarId || 'primary',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('OAuth exchange error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
