export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      a2u_payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          memo: string
          pi_payment_id: string | null
          pi_txid: string | null
          pi_uid: string | null
          pi_username: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          memo?: string
          pi_payment_id?: string | null
          pi_txid?: string | null
          pi_uid?: string | null
          pi_username?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          memo?: string
          pi_payment_id?: string | null
          pi_txid?: string | null
          pi_uid?: string | null
          pi_username?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_self_send_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          reason: string
          reviewed_by_email: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          reason?: string
          reviewed_by_email: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          reason?: string
          reviewed_by_email?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_self_send_reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_response: string | null
          created_at: string
          description: string
          id: string
          reason: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          description?: string
          id?: string
          reason?: string
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          description?: string
          id?: string
          reason?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_notifications_outbox: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_outbox_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          recipient_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          recipient_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          recipient_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoices_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ledger_events: {
        Row: {
          actor_user_id: string | null
          amount: number | null
          event_type: string
          id: string
          note: string | null
          occurred_at: string
          payload: Json
          recorded_at: string
          related_user_id: string | null
          source_id: string
          source_table: string
          status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          amount?: number | null
          event_type: string
          id?: string
          note?: string | null
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          related_user_id?: string | null
          source_id: string
          source_table: string
          status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          amount?: number | null
          event_type?: string
          id?: string
          note?: string | null
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          related_user_id?: string | null
          source_id?: string
          source_table?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ledger_events_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      merchant_api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_mode: string
          key_name: string
          last_used_at: string | null
          merchant_user_id: string
          publishable_key: string
          revoked_at: string | null
          secret_key_hash: string
          secret_key_last4: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_mode: string
          key_name?: string
          last_used_at?: string | null
          merchant_user_id: string
          publishable_key: string
          revoked_at?: string | null
          secret_key_hash: string
          secret_key_last4: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_mode?: string
          key_name?: string
          last_used_at?: string | null
          merchant_user_id?: string
          publishable_key?: string
          revoked_at?: string | null
          secret_key_hash?: string
          secret_key_last4?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_api_keys_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      merchant_balance_transfers: {
        Row: {
          amount: number
          created_at: string
          currency: string
          destination: string
          id: string
          key_mode: string
          merchant_user_id: string
          note: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          destination: string
          id?: string
          key_mode: string
          merchant_user_id: string
          note?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          destination?: string
          id?: string
          key_mode?: string
          merchant_user_id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_balance_transfers_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      merchant_checkout_session_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          line_total: number
          product_id: string | null
          quantity: number
          session_id: string
          unit_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          line_total: number
          product_id?: string | null
          quantity: number
          session_id: string
          unit_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          session_id?: string
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_checkout_session_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_checkout_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "merchant_checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_checkout_sessions: {
        Row: {
          api_key_id: string | null
          cancel_url: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          expires_at: string
          fee_amount: number
          id: string
          key_mode: string
          merchant_user_id: string
          metadata: Json
          paid_at: string | null
          session_token: string
          status: string
          subtotal_amount: number
          success_url: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          api_key_id?: string | null
          cancel_url?: string | null
          created_at?: string
          currency: string
          customer_email?: string | null
          customer_name?: string | null
          expires_at: string
          fee_amount?: number
          id?: string
          key_mode: string
          merchant_user_id: string
          metadata?: Json
          paid_at?: string | null
          session_token: string
          status?: string
          subtotal_amount?: number
          success_url?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          api_key_id?: string | null
          cancel_url?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          expires_at?: string
          fee_amount?: number
          id?: string
          key_mode?: string
          merchant_user_id?: string
          metadata?: Json
          paid_at?: string | null
          session_token?: string
          status?: string
          subtotal_amount?: number
          success_url?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_checkout_sessions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_checkout_sessions_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      merchant_payment_link_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          line_total: number
          link_id: string
          product_id: string | null
          quantity: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          line_total: number
          link_id: string
          product_id?: string | null
          quantity: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          line_total?: number
          link_id?: string
          product_id?: string | null
          quantity?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_link_items_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "merchant_payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payment_link_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payment_link_share_settings: {
        Row: {
          button_label: string
          button_size: string
          button_style: string
          created_at: string
          direct_open_new_tab: boolean
          iframe_height: number
          link_id: string
          merchant_user_id: string
          qr_logo_enabled: boolean
          qr_logo_url: string
          qr_size: number
          updated_at: string
          widget_theme: string
        }
        Insert: {
          button_label?: string
          button_size?: string
          button_style?: string
          created_at?: string
          direct_open_new_tab?: boolean
          iframe_height?: number
          link_id: string
          merchant_user_id: string
          qr_logo_enabled?: boolean
          qr_logo_url?: string
          qr_size?: number
          updated_at?: string
          widget_theme?: string
        }
        Update: {
          button_label?: string
          button_size?: string
          button_style?: string
          created_at?: string
          direct_open_new_tab?: boolean
          iframe_height?: number
          link_id?: string
          merchant_user_id?: string
          qr_logo_enabled?: boolean
          qr_logo_url?: string
          qr_size?: number
          updated_at?: string
          widget_theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_link_share_settings_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: true
            referencedRelation: "merchant_payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payment_link_share_settings_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      merchant_payment_links: {
        Row: {
          after_payment_type: string
          api_key_id: string | null
          call_to_action: string
          collect_address: boolean
          collect_customer_email: boolean
          collect_customer_name: boolean
          collect_phone: boolean
          confirmation_message: string
          created_at: string
          currency: string
          custom_amount: number | null
          description: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_mode: string
          link_token: string
          link_type: string
          merchant_user_id: string
          redirect_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          after_payment_type?: string
          api_key_id?: string | null
          call_to_action?: string
          collect_address?: boolean
          collect_customer_email?: boolean
          collect_customer_name?: boolean
          collect_phone?: boolean
          confirmation_message?: string
          created_at?: string
          currency?: string
          custom_amount?: number | null
          description?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_mode: string
          link_token: string
          link_type: string
          merchant_user_id: string
          redirect_url?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          after_payment_type?: string
          api_key_id?: string | null
          call_to_action?: string
          collect_address?: boolean
          collect_customer_email?: boolean
          collect_customer_name?: boolean
          collect_phone?: boolean
          confirmation_message?: string
          created_at?: string
          currency?: string
          custom_amount?: number | null
          description?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_mode?: string
          link_token?: string
          link_type?: string
          merchant_user_id?: string
          redirect_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_links_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payment_links_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      merchant_payments: {
        Row: {
          amount: number
          api_key_id: string | null
          buyer_user_id: string
          created_at: string
          currency: string
          id: string
          key_mode: string
          merchant_user_id: string
          payment_link_id: string | null
          payment_link_token: string | null
          session_id: string
          status: string
          transaction_id: string
        }
        Insert: {
          amount: number
          api_key_id?: string | null
          buyer_user_id: string
          created_at?: string
          currency: string
          id?: string
          key_mode: string
          merchant_user_id: string
          payment_link_id?: string | null
          payment_link_token?: string | null
          session_id: string
          status?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          api_key_id?: string | null
          buyer_user_id?: string
          created_at?: string
          currency?: string
          id?: string
          key_mode?: string
          merchant_user_id?: string
          payment_link_id?: string | null
          payment_link_token?: string | null
          session_id?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payments_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payments_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "merchant_payments_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "merchant_payments_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "merchant_payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "merchant_checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_pos_api_settings: {
        Row: {
          live_api_key_id: string | null
          merchant_user_id: string
          sandbox_api_key_id: string | null
          updated_at: string
        }
        Insert: {
          live_api_key_id?: string | null
          merchant_user_id: string
          sandbox_api_key_id?: string | null
          updated_at?: string
        }
        Update: {
          live_api_key_id?: string | null
          merchant_user_id?: string
          sandbox_api_key_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_pos_api_settings_live_api_key_id_fkey"
            columns: ["live_api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_pos_api_settings_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "merchant_pos_api_settings_sandbox_api_key_id_fkey"
            columns: ["sandbox_api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_products: {
        Row: {
          checkout_info: string
          created_at: string
          currency: string
          id: string
          image_url: string | null
          is_active: boolean
          media_urls: string[]
          merchant_user_id: string
          metadata: Json
          pricing_type: string
          product_code: string
          product_description: string
          product_name: string
          product_tags: string[]
          published_at: string | null
          repeat_every: number | null
          repeat_unit: string | null
          tax_code: string | null
          unit_amount: number
          updated_at: string
        }
        Insert: {
          checkout_info?: string
          created_at?: string
          currency?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          media_urls?: string[]
          merchant_user_id: string
          metadata?: Json
          pricing_type?: string
          product_code: string
          product_description?: string
          product_name: string
          product_tags?: string[]
          published_at?: string | null
          repeat_every?: number | null
          repeat_unit?: string | null
          tax_code?: string | null
          unit_amount: number
          updated_at?: string
        }
        Update: {
          checkout_info?: string
          created_at?: string
          currency?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          media_urls?: string[]
          merchant_user_id?: string
          metadata?: Json
          pricing_type?: string
          product_code?: string
          product_description?: string
          product_name?: string
          product_tags?: string[]
          published_at?: string | null
          repeat_every?: number | null
          repeat_unit?: string | null
          tax_code?: string | null
          unit_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_products_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      merchant_profiles: {
        Row: {
          created_at: string
          default_currency: string
          is_active: boolean
          merchant_logo_url: string | null
          merchant_name: string
          merchant_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          is_active?: boolean
          merchant_logo_url?: string | null
          merchant_name?: string
          merchant_username?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          is_active?: boolean
          merchant_logo_url?: string | null
          merchant_name?: string
          merchant_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mining_rewards: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mining_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mining_sessions: {
        Row: {
          expires_at: string
          id: string
          is_active: boolean | null
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          expires_at: string
          id?: string
          is_active?: boolean | null
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          expires_at?: string
          id?: string
          is_active?: boolean | null
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mining_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      open_partner_leads: {
        Row: {
          admin_note: string | null
          business_type: string | null
          company_name: string
          contact_email: string
          contact_name: string
          country: string | null
          created_at: string
          estimated_monthly_volume: string | null
          id: string
          integration_type: string | null
          message: string | null
          requester_user_id: string
          status: string
          updated_at: string
          use_case_summary: string
          website_url: string | null
        }
        Insert: {
          admin_note?: string | null
          business_type?: string | null
          company_name: string
          contact_email: string
          contact_name: string
          country?: string | null
          created_at?: string
          estimated_monthly_volume?: string | null
          id?: string
          integration_type?: string | null
          message?: string | null
          requester_user_id: string
          status?: string
          updated_at?: string
          use_case_summary?: string
          website_url?: string | null
        }
        Update: {
          admin_note?: string | null
          business_type?: string | null
          company_name?: string
          contact_email?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          estimated_monthly_volume?: string | null
          id?: string
          integration_type?: string | null
          message?: string | null
          requester_user_id?: string
          status?: string
          updated_at?: string
          use_case_summary?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "open_partner_leads_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      openpay_authorization_codes: {
        Row: {
          authorization_code: string
          created_at: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          authorization_code: string
          created_at?: string
          expires_at: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          authorization_code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "openpay_authorization_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      openpay_runtime_settings: {
        Row: {
          setting_key: string
          updated_at: string
          value_json: Json
        }
        Insert: {
          setting_key: string
          updated_at?: string
          value_json?: Json
        }
        Update: {
          setting_key?: string
          updated_at?: string
          value_json?: Json
        }
        Relationships: []
      }
      payment_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          ip_address: unknown
          payout_id: string | null
          status_after: string | null
          status_before: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          payout_id?: string | null
          status_after?: string | null
          status_before?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          payout_id?: string | null
          status_after?: string | null
          status_before?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_log_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "a2u_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_log_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "recent_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payer_id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payer_id: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payer_id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "payment_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pi_payment_credits: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          status: string
          txid: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_id: string
          status?: string
          txid?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          status?: string
          txid?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pi_payment_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          referral_code: string
          referred_by_user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          referral_code: string
          referred_by_user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          referral_code?: string
          referred_by_user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_referred_by_user_id_fkey"
            columns: ["referred_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
          reward_amount: number
          status: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
          reward_amount?: number
          status?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
          reward_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referral_rewards_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      remittance_merchants: {
        Row: {
          banner_subtitle: string
          banner_title: string
          business_note: string
          created_at: string
          deposit_fee_percent: number
          fee_notes: string
          fee_title: string
          flat_service_fee: number
          is_active: boolean
          merchant_city: string
          merchant_country: string
          merchant_logo_url: string
          merchant_name: string
          merchant_username: string
          min_operating_balance: number
          payout_fee_percent: number
          qr_accent: string
          qr_background: string
          qr_tagline: string
          updated_at: string
          user_id: string
        }
        Insert: {
          banner_subtitle?: string
          banner_title?: string
          business_note?: string
          created_at?: string
          deposit_fee_percent?: number
          fee_notes?: string
          fee_title?: string
          flat_service_fee?: number
          is_active?: boolean
          merchant_city?: string
          merchant_country?: string
          merchant_logo_url?: string
          merchant_name?: string
          merchant_username?: string
          min_operating_balance?: number
          payout_fee_percent?: number
          qr_accent?: string
          qr_background?: string
          qr_tagline?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          banner_subtitle?: string
          banner_title?: string
          business_note?: string
          created_at?: string
          deposit_fee_percent?: number
          fee_notes?: string
          fee_title?: string
          flat_service_fee?: number
          is_active?: boolean
          merchant_city?: string
          merchant_country?: string
          merchant_logo_url?: string
          merchant_name?: string
          merchant_username?: string
          min_operating_balance?: number
          payout_fee_percent?: number
          qr_accent?: string
          qr_background?: string
          qr_tagline?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remittance_merchants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      support_agents: {
        Row: {
          created_at: string
          handle: string
          user_id: string
        }
        Insert: {
          created_at?: string
          handle?: string
          user_id: string
        }
        Update: {
          created_at?: string
          handle?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      support_faq_categories: {
        Row: {
          created_at: string
          description: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      support_faq_items: {
        Row: {
          answer: string
          category_id: string | null
          created_at: string
          id: string
          question: string
          tags: string[]
        }
        Insert: {
          answer: string
          category_id?: string | null
          created_at?: string
          id?: string
          question: string
          tags?: string[]
        }
        Update: {
          answer?: string
          category_id?: string | null
          created_at?: string
          id?: string
          question?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "support_faq_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "support_faq_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          sender_id: string
          sender_role?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      supported_currencies: {
        Row: {
          created_at: string
          display_code: string
          display_name: string
          flag: string
          is_active: boolean
          iso_code: string
          symbol: string
          updated_at: string
          usd_rate: number
        }
        Insert: {
          created_at?: string
          display_code: string
          display_name: string
          flag: string
          is_active?: boolean
          iso_code: string
          symbol: string
          updated_at?: string
          usd_rate: number
        }
        Update: {
          created_at?: string
          display_code?: string
          display_name?: string
          flag?: string
          is_active?: boolean
          iso_code?: string
          symbol?: string
          updated_at?: string
          usd_rate?: number
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string | null
          description: string | null
          is_encrypted: boolean | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          is_encrypted?: boolean | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          is_encrypted?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_username: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string
          account_number: string
          account_username?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_username?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_balance_tracking: {
        Row: {
          created_at: string | null
          daily_payouts: number | null
          daily_reset_date: string | null
          id: string
          last_payout_at: string | null
          monthly_payouts: number | null
          monthly_reset_date: string | null
          payout_count: number | null
          total_payouts: number | null
          updated_at: string | null
          user_id: string | null
          weekly_payouts: number | null
          weekly_reset_date: string | null
        }
        Insert: {
          created_at?: string | null
          daily_payouts?: number | null
          daily_reset_date?: string | null
          id?: string
          last_payout_at?: string | null
          monthly_payouts?: number | null
          monthly_reset_date?: string | null
          payout_count?: number | null
          total_payouts?: number | null
          updated_at?: string | null
          user_id?: string | null
          weekly_payouts?: number | null
          weekly_reset_date?: string | null
        }
        Update: {
          created_at?: string | null
          daily_payouts?: number | null
          daily_reset_date?: string | null
          id?: string
          last_payout_at?: string | null
          monthly_payouts?: number | null
          monthly_reset_date?: string | null
          payout_count?: number | null
          total_payouts?: number | null
          updated_at?: string | null
          user_id?: string | null
          weekly_payouts?: number | null
          weekly_reset_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_balance_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_loan_applications: {
        Row: {
          address_line: string
          admin_note: string
          agreement_accepted: boolean
          agreement_accepted_at: string | null
          city: string
          contact_number: string
          country: string
          created_at: string
          credit_score_snapshot: number
          full_name: string
          id: string
          openpay_account_number: string
          openpay_account_username: string
          requested_amount: number
          requested_term_months: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line?: string
          admin_note?: string
          agreement_accepted?: boolean
          agreement_accepted_at?: string | null
          city?: string
          contact_number?: string
          country?: string
          created_at?: string
          credit_score_snapshot?: number
          full_name?: string
          id?: string
          openpay_account_number?: string
          openpay_account_username?: string
          requested_amount: number
          requested_term_months: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          admin_note?: string
          agreement_accepted?: boolean
          agreement_accepted_at?: string | null
          city?: string
          contact_number?: string
          country?: string
          created_at?: string
          credit_score_snapshot?: number
          full_name?: string
          id?: string
          openpay_account_number?: string
          openpay_account_username?: string
          requested_amount?: number
          requested_term_months?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_loan_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_loan_payments: {
        Row: {
          amount: number
          created_at: string
          fee_component: number
          id: string
          loan_id: string
          note: string
          payment_method: string
          payment_reference: string | null
          principal_component: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_component: number
          id?: string
          loan_id: string
          note?: string
          payment_method?: string
          payment_reference?: string | null
          principal_component: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_component?: number
          id?: string
          loan_id?: string
          note?: string
          payment_method?: string
          payment_reference?: string | null
          principal_component?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "user_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_loan_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_loans: {
        Row: {
          created_at: string
          credit_score: number
          id: string
          monthly_fee_rate: number
          monthly_payment_amount: number
          next_due_date: string
          outstanding_amount: number
          paid_months: number
          principal_amount: number
          status: string
          term_months: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_score?: number
          id?: string
          monthly_fee_rate?: number
          monthly_payment_amount: number
          next_due_date: string
          outstanding_amount: number
          paid_months?: number
          principal_amount: number
          status?: string
          term_months: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_score?: number
          id?: string
          monthly_fee_rate?: number
          monthly_payment_amount?: number
          next_due_date?: string
          outstanding_amount?: number
          paid_months?: number
          principal_amount?: number
          status?: string
          term_months?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_loans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          hide_balance: boolean
          merchant_onboarding_data: Json
          onboarding_completed: boolean
          onboarding_step: number
          profile_full_name: string | null
          profile_username: string | null
          qr_print_settings: Json
          reference_code: string | null
          security_settings: Json
          updated_at: string
          usage_agreement_accepted: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          hide_balance?: boolean
          merchant_onboarding_data?: Json
          onboarding_completed?: boolean
          onboarding_step?: number
          profile_full_name?: string | null
          profile_username?: string | null
          qr_print_settings?: Json
          reference_code?: string | null
          security_settings?: Json
          updated_at?: string
          usage_agreement_accepted?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          hide_balance?: boolean
          merchant_onboarding_data?: Json
          onboarding_completed?: boolean
          onboarding_step?: number
          profile_full_name?: string | null
          profile_username?: string | null
          qr_print_settings?: Json
          reference_code?: string | null
          security_settings?: Json
          updated_at?: string
          usage_agreement_accepted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          id: string
          pi_access_token: string | null
          pi_refresh_token: string | null
          pi_token_expires_at: string | null
          pi_uid: string | null
          pi_username: string | null
          pi_verified: boolean | null
          supabase_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pi_access_token?: string | null
          pi_refresh_token?: string | null
          pi_token_expires_at?: string | null
          pi_uid?: string | null
          pi_username?: string | null
          pi_verified?: boolean | null
          supabase_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pi_access_token?: string | null
          pi_refresh_token?: string | null
          pi_token_expires_at?: string | null
          pi_uid?: string | null
          pi_username?: string | null
          pi_verified?: boolean | null
          supabase_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_supabase_user_id_fkey"
            columns: ["supabase_user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_savings_accounts: {
        Row: {
          apy: number
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apy?: number
          balance?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apy?: number
          balance?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_savings_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_savings_transfers: {
        Row: {
          amount: number
          created_at: string
          direction: string
          fee_amount: number
          id: string
          note: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          direction: string
          fee_amount?: number
          id?: string
          note?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          direction?: string
          fee_amount?: number
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_savings_transfers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      virtual_cards: {
        Row: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details: boolean
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_number: string
          card_settings?: Json
          card_username?: string
          cardholder_name?: string
          created_at?: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details?: boolean
          id?: string
          is_active?: boolean
          is_locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_number?: string
          card_settings?: Json
          card_username?: string
          cardholder_name?: string
          created_at?: string
          cvc?: string
          expiry_month?: number
          expiry_year?: number
          hide_details?: boolean
          id?: string
          is_active?: boolean
          is_locked?: boolean
          locked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          id: string
          updated_at: string
          user_id: string
          welcome_bonus_claimed_at: string | null
        }
        Insert: {
          balance?: number
          id?: string
          updated_at?: string
          user_id: string
          welcome_bonus_claimed_at?: string | null
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
          user_id?: string
          welcome_bonus_claimed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      merchant_product_stats: {
        Row: {
          merchant_user_id: string | null
          product_id: string | null
          total_purchases: number | null
          total_revenue: number | null
          total_sales: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_checkout_session_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_checkout_sessions_merchant_user_id_fkey"
            columns: ["merchant_user_id"]
            isOneToOne: false
            referencedRelation: "user_payout_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payout_statistics: {
        Row: {
          average_amount: number | null
          date: string | null
          max_amount: number | null
          min_amount: number | null
          payout_count: number | null
          status: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      recent_payouts: {
        Row: {
          amount: number | null
          completed_at: string | null
          created_at: string | null
          id: string | null
          memo: string | null
          pi_username: string | null
          status: string | null
          status_icon: string | null
        }
        Relationships: []
      }
      user_payout_summary: {
        Row: {
          daily_payouts: number | null
          email: string | null
          last_payout_at: string | null
          monthly_payouts: number | null
          pi_uid: string | null
          pi_username: string | null
          pi_verified: boolean | null
          total_payout_count: number | null
          total_payouts: number | null
          user_id: string | null
          user_profile_created_at: string | null
          weekly_payouts: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_dashboard_history:
        | { Args: never; Returns: Json }
        | { Args: { p_limit: number; p_offset: number }; Returns: Json }
      admin_list_loan_applications: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          address_line: string
          admin_note: string
          agreement_accepted: boolean
          applicant_display_name: string
          city: string
          contact_number: string
          country: string
          created_at: string
          credit_score_snapshot: number
          full_name: string
          id: string
          openpay_account_number: string
          openpay_account_username: string
          requested_amount: number
          requested_term_months: number
          reviewed_at: string
          status: string
          user_id: string
        }[]
      }
      admin_refund_self_send: {
        Args: {
          p_admin_email?: string
          p_decision: string
          p_reason?: string
          p_transaction_id: string
        }
        Returns: Json
      }
      admin_review_loan_application: {
        Args: {
          p_admin_note?: string
          p_application_id: string
          p_decision: string
        }
        Returns: string
      }
      apply_usd_exchange_rates: { Args: { p_rates: Json }; Returns: number }
      calculate_user_activity_credit_score: {
        Args: { p_user_id: string }
        Returns: number
      }
      can_user_unlock_loans: {
        Args: { p_user_id: string }
        Returns: {
          required_activity: number
          required_score: number
          score: number
          total_activity: number
          unlocked: boolean
        }[]
      }
      claim_referral_rewards: { Args: never; Returns: Json }
      claim_welcome_bonus: { Args: never; Returns: Json }
      complete_merchant_checkout_with_transaction:
        | {
            Args: {
              p_note?: string
              p_session_token: string
              p_transaction_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_customer_address?: string
              p_customer_email?: string
              p_customer_name?: string
              p_customer_phone?: string
              p_note?: string
              p_session_token: string
              p_transaction_id: string
            }
            Returns: string
          }
      create_checkout_session_from_payment_link: {
        Args: {
          p_customer_email?: string
          p_customer_name?: string
          p_link_token: string
        }
        Returns: {
          after_payment_type: string
          call_to_action: string
          confirmation_message: string
          currency: string
          expires_at: string
          redirect_url: string
          session_id: string
          session_token: string
          total_amount: number
        }[]
      }
      create_merchant_checkout_session: {
        Args: {
          p_cancel_url?: string
          p_currency: string
          p_customer_email?: string
          p_customer_name?: string
          p_expires_in_minutes?: number
          p_items: Json
          p_metadata?: Json
          p_mode: string
          p_secret_key: string
          p_success_url?: string
        }
        Returns: {
          currency: string
          expires_at: string
          session_id: string
          session_token: string
          total_amount: number
        }[]
      }
      create_merchant_payment_link: {
        Args: {
          p_after_payment_type?: string
          p_call_to_action?: string
          p_collect_address?: boolean
          p_collect_customer_email?: boolean
          p_collect_customer_name?: boolean
          p_collect_phone?: boolean
          p_confirmation_message?: string
          p_currency?: string
          p_custom_amount?: number
          p_description?: string
          p_expires_in_minutes?: number
          p_items?: Json
          p_link_type: string
          p_mode: string
          p_redirect_url?: string
          p_secret_key: string
          p_title?: string
        }
        Returns: {
          currency: string
          expires_at: string
          key_mode: string
          link_id: string
          link_token: string
          total_amount: number
        }[]
      }
      create_my_merchant_api_key: {
        Args: { p_key_name?: string; p_mode: string }
        Returns: {
          id: string
          key_mode: string
          key_name: string
          publishable_key: string
          secret_key: string
        }[]
      }
      create_my_pos_checkout_session: {
        Args: {
          p_amount: number
          p_currency?: string
          p_customer_email?: string
          p_customer_name?: string
          p_expires_in_minutes?: number
          p_mode?: string
          p_qr_style?: string
          p_reference?: string
          p_secret_key?: string
        }
        Returns: {
          currency: string
          expires_at: string
          qr_payload: string
          session_id: string
          session_token: string
          status: string
          total_amount: number
        }[]
      }
      delete_my_merchant_api_key: {
        Args: { p_key_id: string }
        Returns: boolean
      }
      delete_my_merchant_checkout_link: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      delete_my_merchant_payment_link: {
        Args: { p_link_id: string }
        Returns: boolean
      }
      digest: { Args: { algorithm: string; data: string }; Returns: string }
      find_user_by_account_number: {
        Args: { p_account_number: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          username: string
        }[]
      }
      gen_random_bytes: { Args: { length: number }; Returns: string }
      generate_merchant_api_key: { Args: { p_prefix: string }; Returns: string }
      generate_openpay_account_number: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_openpay_authorization_code: { Args: never; Returns: string }
      generate_openpay_card_number: { Args: never; Returns: string }
      generate_openpay_cvc: { Args: never; Returns: string }
      get_my_credit_score: { Args: never; Returns: number }
      get_my_latest_loan: {
        Args: never
        Returns: {
          created_at: string
          credit_score: number
          id: string
          monthly_fee_rate: number
          monthly_payment_amount: number
          next_due_date: string
          outstanding_amount: number
          paid_months: number
          principal_amount: number
          status: string
          term_months: number
        }[]
      }
      get_my_latest_loan_application: {
        Args: never
        Returns: {
          address_line: string
          admin_note: string
          agreement_accepted: boolean
          agreement_accepted_at: string | null
          city: string
          contact_number: string
          country: string
          created_at: string
          credit_score_snapshot: number
          full_name: string
          id: string
          openpay_account_number: string
          openpay_account_username: string
          requested_amount: number
          requested_term_months: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_loan_payment_history: {
        Args: { p_limit?: number; p_loan_id?: string }
        Returns: {
          amount: number
          created_at: string
          fee_component: number
          id: string
          loan_id: string
          note: string
          payment_method: string
          payment_reference: string
          principal_component: number
        }[]
      }
      get_my_merchant_activity: {
        Args: { p_limit?: number; p_mode?: string; p_offset?: number }
        Returns: {
          activity_id: string
          activity_type: string
          amount: number
          counterparty_email: string
          counterparty_name: string
          counterparty_username: string
          created_at: string
          currency: string
          note: string
          source: string
          status: string
        }[]
      }
      get_my_merchant_analytics: {
        Args: { p_days?: number; p_mode?: string }
        Returns: Json
      }
      get_my_merchant_balance_overview: {
        Args: { p_mode?: string }
        Returns: {
          available_balance: number
          gross_volume: number
          refunded_total: number
          savings_balance: number
          transferred_total: number
          wallet_balance: number
        }[]
      }
      get_my_openpay_code: { Args: never; Returns: string }
      get_my_payment_link_share_settings: {
        Args: { p_link_id: string }
        Returns: {
          button_label: string
          button_size: string
          button_style: string
          created_at: string
          direct_open_new_tab: boolean
          iframe_height: number
          link_id: string
          merchant_user_id: string
          qr_logo_enabled: boolean
          qr_logo_url: string
          qr_size: number
          updated_at: string
          widget_theme: string
        }
        SetofOptions: {
          from: "*"
          to: "merchant_payment_link_share_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_pos_api_key_settings: {
        Args: never
        Returns: {
          live_api_key_id: string
          live_key_name: string
          live_publishable_key: string
          sandbox_api_key_id: string
          sandbox_key_name: string
          sandbox_publishable_key: string
        }[]
      }
      get_my_pos_dashboard: {
        Args: { p_mode?: string }
        Returns: {
          key_mode: string
          merchant_name: string
          merchant_username: string
          refunded_transactions: number
          today_total_received: number
          today_transactions: number
          wallet_balance: number
        }[]
      }
      get_my_pos_transactions: {
        Args: {
          p_limit?: number
          p_mode?: string
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          amount: number
          currency: string
          customer_email: string
          customer_name: string
          payer_name: string
          payer_user_id: string
          payer_username: string
          payment_created_at: string
          payment_id: string
          payment_status: string
          session_token: string
          transaction_id: string
          transaction_note: string
        }[]
      }
      get_my_savings_dashboard: {
        Args: never
        Returns: {
          apy: number
          savings_balance: number
          wallet_balance: number
        }[]
      }
      get_openpay_settlement_user_id: { Args: never; Returns: string }
      get_public_ledger: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          amount: number
          event_type: string
          note: string
          occurred_at: string
          status: string
        }[]
      }
      get_public_ledger_transaction: {
        Args: { p_transaction_id: string }
        Returns: {
          amount: number
          event_type: string
          note: string
          occurred_at: string
          status: string
        }[]
      }
      get_public_merchant_checkout_session: {
        Args: { p_session_token: string }
        Returns: {
          amount: number
          currency: string
          expires_at: string
          items: Json
          merchant_logo_url: string
          merchant_name: string
          merchant_user_id: string
          merchant_username: string
          mode: string
          session_id: string
          status: string
        }[]
      }
      get_public_merchant_payment_link: {
        Args: { p_link_token: string }
        Returns: {
          after_payment_type: string
          call_to_action: string
          collect_address: boolean
          collect_customer_email: boolean
          collect_customer_name: boolean
          collect_phone: boolean
          confirmation_message: string
          currency: string
          description: string
          expires_at: string
          items: Json
          link_id: string
          link_token: string
          link_type: string
          merchant_logo_url: string
          merchant_name: string
          merchant_user_id: string
          merchant_username: string
          mode: string
          redirect_url: string
          title: string
          total_amount: number
        }[]
      }
      is_openpay_core_admin: { Args: never; Returns: boolean }
      is_support_agent: { Args: { p_user_id: string }; Returns: boolean }
      is_transaction_participant: {
        Args: { _transaction_id: string }
        Returns: boolean
      }
      issue_my_openpay_authorization_code: {
        Args: { p_force_new?: boolean }
        Returns: {
          authorization_code: string
          expires_at: string
        }[]
      }
      normalize_openpay_authorization_code: {
        Args: { p_code: string }
        Returns: string
      }
      normalize_openpay_code: { Args: { p_code: string }; Returns: string }
      pay_merchant_checkout_with_virtual_card:
        | {
            Args: {
              p_card_number: string
              p_cvc: string
              p_expiry_month: number
              p_expiry_year: number
              p_note?: string
              p_session_token: string
            }
            Returns: string
          }
        | {
            Args: {
              p_card_number: string
              p_customer_address?: string
              p_customer_email?: string
              p_customer_name?: string
              p_customer_phone?: string
              p_cvc: string
              p_expiry_month: number
              p_expiry_year: number
              p_note?: string
              p_session_token: string
            }
            Returns: string
          }
      pay_merchant_checkout_with_wallet: {
        Args: {
          p_customer_address?: string
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_note?: string
          p_session_token: string
        }
        Returns: string
      }
      pay_my_loan_monthly: {
        Args: { p_amount?: number; p_loan_id: string; p_note?: string }
        Returns: {
          loan_id: string
          paid_months: number
          remaining_balance: number
          status: string
          wallet_balance: number
        }[]
      }
      pay_my_loan_monthly_with_method: {
        Args: {
          p_amount?: number
          p_loan_id: string
          p_note?: string
          p_payment_method?: string
          p_payment_reference?: string
        }
        Returns: {
          loan_id: string
          paid_months: number
          remaining_balance: number
          status: string
          wallet_balance: number
        }[]
      }
      pay_with_virtual_card_checkout: {
        Args: {
          p_amount: number
          p_card_number: string
          p_cvc: string
          p_expiry_month: number
          p_expiry_year: number
          p_note?: string
          p_receiver_id: string
        }
        Returns: string
      }
      random_token_hex: { Args: { p_bytes?: number }; Returns: string }
      refund_my_pos_transaction: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: {
          new_status: string
          refund_transaction_id: string
          refunded_at: string
        }[]
      }
      request_my_openpay_loan: {
        Args: {
          p_credit_score?: number
          p_principal_amount: number
          p_term_months?: number
        }
        Returns: {
          created_at: string
          credit_score: number
          id: string
          monthly_fee_rate: number
          monthly_payment_amount: number
          next_due_date: string
          outstanding_amount: number
          paid_months: number
          principal_amount: number
          status: string
          term_months: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_loans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_my_merchant_api_key: {
        Args: { p_key_id: string }
        Returns: boolean
      }
      save_my_virtual_card_signature: {
        Args: { p_signature: string }
        Returns: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details: boolean
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "virtual_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_my_loan_application: {
        Args: {
          p_address_line: string
          p_agreement_accepted?: boolean
          p_city: string
          p_contact_number: string
          p_country: string
          p_full_name: string
          p_openpay_account_number: string
          p_openpay_account_username: string
          p_requested_amount: number
          p_requested_term_months: number
        }
        Returns: {
          address_line: string
          admin_note: string
          agreement_accepted: boolean
          agreement_accepted_at: string | null
          city: string
          contact_number: string
          country: string
          created_at: string
          credit_score_snapshot: number
          full_name: string
          id: string
          openpay_account_number: string
          openpay_account_username: string
          requested_amount: number
          requested_term_months: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_loan_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_open_partner_lead: {
        Args: {
          p_business_type?: string
          p_company_name: string
          p_contact_email: string
          p_contact_name: string
          p_country?: string
          p_estimated_monthly_volume?: string
          p_integration_type?: string
          p_message?: string
          p_use_case_summary?: string
          p_website_url?: string
        }
        Returns: {
          admin_note: string | null
          business_type: string | null
          company_name: string
          contact_email: string
          contact_name: string
          country: string | null
          created_at: string
          estimated_monthly_volume: string | null
          id: string
          integration_type: string | null
          message: string | null
          requester_user_id: string
          status: string
          updated_at: string
          use_case_summary: string
          website_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "open_partner_leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_funds: {
        Args: {
          p_amount: number
          p_note?: string
          p_receiver_id: string
          p_sender_id: string
        }
        Returns: string
      }
      transfer_funds_authenticated: {
        Args: { p_amount: number; p_note?: string; p_receiver_id: string }
        Returns: string
      }
      transfer_my_merchant_balance: {
        Args: {
          p_amount: number
          p_destination?: string
          p_mode?: string
          p_note?: string
        }
        Returns: {
          available_balance: number
          savings_balance: number
          transfer_id: string
          wallet_balance: number
        }[]
      }
      transfer_my_savings_to_wallet: {
        Args: { p_amount: number; p_note?: string }
        Returns: {
          savings_balance: number
          transfer_id: string
          wallet_balance: number
        }[]
      }
      transfer_my_wallet_to_savings: {
        Args: { p_amount: number; p_note?: string }
        Returns: {
          savings_balance: number
          transfer_id: string
          wallet_balance: number
        }[]
      }
      update_my_virtual_card_controls: {
        Args: {
          p_card_settings?: Json
          p_hide_details?: boolean
          p_lock_card?: boolean
        }
        Returns: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details: boolean
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "virtual_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_merchant_profile: {
        Args: {
          p_default_currency?: string
          p_merchant_logo_url?: string
          p_merchant_name?: string
          p_merchant_username?: string
        }
        Returns: {
          created_at: string
          default_currency: string
          is_active: boolean
          merchant_logo_url: string | null
          merchant_name: string
          merchant_username: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "merchant_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_payment_link_share_settings: {
        Args: {
          p_button_label?: string
          p_button_size?: string
          p_button_style?: string
          p_direct_open_new_tab?: boolean
          p_iframe_height?: number
          p_link_id: string
          p_qr_logo_enabled?: boolean
          p_qr_logo_url?: string
          p_qr_size?: number
          p_widget_theme?: string
        }
        Returns: {
          button_label: string
          button_size: string
          button_style: string
          created_at: string
          direct_open_new_tab: boolean
          iframe_height: number
          link_id: string
          merchant_user_id: string
          qr_logo_enabled: boolean
          qr_logo_url: string
          qr_size: number
          updated_at: string
          widget_theme: string
        }
        SetofOptions: {
          from: "*"
          to: "merchant_payment_link_share_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_pos_api_key: {
        Args: { p_mode: string; p_secret_key: string }
        Returns: {
          api_key_id: string
          key_name: string
          mode: string
          publishable_key: string
        }[]
      }
      upsert_my_savings_account: {
        Args: never
        Returns: {
          apy: number
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_savings_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_user_account: {
        Args: never
        Returns: {
          account_name: string
          account_number: string
          account_username: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_my_virtual_card: {
        Args: { p_card_username?: string; p_cardholder_name?: string }
        Returns: {
          card_number: string
          card_settings: Json
          card_username: string
          cardholder_name: string
          created_at: string
          cvc: string
          expiry_month: number
          expiry_year: number
          hide_details: boolean
          id: string
          is_active: boolean
          is_locked: boolean
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "virtual_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_my_openpay_authorization_code: {
        Args: { p_code: string }
        Returns: boolean
      }
      verify_my_openpay_code: { Args: { p_code: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
