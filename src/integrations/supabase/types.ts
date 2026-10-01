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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          completion_tokens: number
          created_at: string
          feature: string
          id: string
          model: string | null
          prompt_tokens: number
          user_id: string
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          feature: string
          id?: string
          model?: string | null
          prompt_tokens?: number
          user_id: string
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          feature?: string
          id?: string
          model?: string | null
          prompt_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      app_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          org_id: string | null
          path: string | null
          session_id: string | null
          space: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          org_id?: string | null
          path?: string | null
          session_id?: string | null
          space?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          org_id?: string | null
          path?: string | null
          session_id?: string | null
          space?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      argus_applications: {
        Row: {
          category: string | null
          created_at: string
          criticality: string
          freshness_target: string | null
          has_api: boolean | null
          id: string
          layer: string
          layer_truth: string
          mission_id: string | null
          name: string
          notes: string | null
          owner: string | null
          position_x: number | null
          position_y: number | null
          score: number | null
          slug: string
          trust_tier: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          criticality?: string
          freshness_target?: string | null
          has_api?: boolean | null
          id?: string
          layer: string
          layer_truth?: string
          mission_id?: string | null
          name: string
          notes?: string | null
          owner?: string | null
          position_x?: number | null
          position_y?: number | null
          score?: number | null
          slug: string
          trust_tier?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          criticality?: string
          freshness_target?: string | null
          has_api?: boolean | null
          id?: string
          layer?: string
          layer_truth?: string
          mission_id?: string | null
          name?: string
          notes?: string | null
          owner?: string | null
          position_x?: number | null
          position_y?: number | null
          score?: number | null
          slug?: string
          trust_tier?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "argus_applications_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      argus_external_probes: {
        Row: {
          attribute_id: string | null
          created_at: string
          enabled: boolean
          id: string
          kind: string
          last_error: string | null
          last_run_at: string | null
          last_status: string | null
          last_value: Json | null
          mission_id: string | null
          name: string
          notes: string | null
          pack_slug: string | null
          params: Json
          refresh_interval_minutes: number
          target: string
          updated_at: string
        }
        Insert: {
          attribute_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          last_value?: Json | null
          mission_id?: string | null
          name: string
          notes?: string | null
          pack_slug?: string | null
          params?: Json
          refresh_interval_minutes?: number
          target: string
          updated_at?: string
        }
        Update: {
          attribute_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string | null
          last_value?: Json | null
          mission_id?: string | null
          name?: string
          notes?: string | null
          pack_slug?: string | null
          params?: Json
          refresh_interval_minutes?: number
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "argus_external_probes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "semantic_attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      argus_field_samples: {
        Row: {
          created_at: string
          field_name: string
          field_type: string | null
          id: string
          observed_count: number | null
          sample_values: Json | null
          schema_id: string
        }
        Insert: {
          created_at?: string
          field_name: string
          field_type?: string | null
          id?: string
          observed_count?: number | null
          sample_values?: Json | null
          schema_id: string
        }
        Update: {
          created_at?: string
          field_name?: string
          field_type?: string | null
          id?: string
          observed_count?: number | null
          sample_values?: Json | null
          schema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "argus_field_samples_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "argus_schemas"
            referencedColumns: ["id"]
          },
        ]
      }
      argus_flows: {
        Row: {
          created_at: string
          detected_by: string | null
          flow_type: string | null
          format: string | null
          frequency: string | null
          id: string
          mission_id: string | null
          name: string
          notes: string | null
          quality_score: number | null
          source_app_id: string | null
          target_app_id: string | null
          updated_at: string
          volume: string | null
        }
        Insert: {
          created_at?: string
          detected_by?: string | null
          flow_type?: string | null
          format?: string | null
          frequency?: string | null
          id?: string
          mission_id?: string | null
          name: string
          notes?: string | null
          quality_score?: number | null
          source_app_id?: string | null
          target_app_id?: string | null
          updated_at?: string
          volume?: string | null
        }
        Update: {
          created_at?: string
          detected_by?: string | null
          flow_type?: string | null
          format?: string | null
          frequency?: string | null
          id?: string
          mission_id?: string | null
          name?: string
          notes?: string | null
          quality_score?: number | null
          source_app_id?: string | null
          target_app_id?: string | null
          updated_at?: string
          volume?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "argus_flows_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "argus_flows_source_app_id_fkey"
            columns: ["source_app_id"]
            isOneToOne: false
            referencedRelation: "argus_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "argus_flows_target_app_id_fkey"
            columns: ["target_app_id"]
            isOneToOne: false
            referencedRelation: "argus_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      argus_mapping_proposals: {
        Row: {
          combined_score: number
          created_at: string
          field_name: string
          field_type: string | null
          id: string
          jaccard_score: number
          llm_rationale: string | null
          llm_score: number
          sample_values: Json | null
          schema_id: string
          semantic_attribute_id: string
          semantic_score: number
          source_system_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          combined_score?: number
          created_at?: string
          field_name: string
          field_type?: string | null
          id?: string
          jaccard_score?: number
          llm_rationale?: string | null
          llm_score?: number
          sample_values?: Json | null
          schema_id: string
          semantic_attribute_id: string
          semantic_score?: number
          source_system_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          combined_score?: number
          created_at?: string
          field_name?: string
          field_type?: string | null
          id?: string
          jaccard_score?: number
          llm_rationale?: string | null
          llm_score?: number
          sample_values?: Json | null
          schema_id?: string
          semantic_attribute_id?: string
          semantic_score?: number
          source_system_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "argus_mapping_proposals_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "argus_schemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "argus_mapping_proposals_semantic_attribute_id_fkey"
            columns: ["semantic_attribute_id"]
            isOneToOne: false
            referencedRelation: "semantic_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "argus_mapping_proposals_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      argus_schemas: {
        Row: {
          discovered_at: string
          endpoint_path: string
          entity_label: string | null
          http_method: string
          id: string
          mission_id: string | null
          record_count: number | null
          sample_record: Json | null
          source_system_id: string | null
          summary: string | null
        }
        Insert: {
          discovered_at?: string
          endpoint_path: string
          entity_label?: string | null
          http_method?: string
          id?: string
          mission_id?: string | null
          record_count?: number | null
          sample_record?: Json | null
          source_system_id?: string | null
          summary?: string | null
        }
        Update: {
          discovered_at?: string
          endpoint_path?: string
          entity_label?: string | null
          http_method?: string
          id?: string
          mission_id?: string | null
          record_count?: number | null
          sample_record?: Json | null
          source_system_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "argus_schemas_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "argus_schemas_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      board_packs: {
        Row: {
          created_at: string | null
          created_by: string | null
          generated_at: string | null
          id: string
          meeting_date: string | null
          mission_id: string | null
          sections: Json
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          generated_at?: string | null
          id?: string
          meeting_date?: string | null
          mission_id?: string | null
          sections?: Json
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          generated_at?: string | null
          id?: string
          meeting_date?: string | null
          mission_id?: string | null
          sections?: Json
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_packs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      business_capabilities: {
        Row: {
          created_at: string
          description: string | null
          domain: string | null
          id: string
          mission_id: string
          name: string
          ord: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          mission_id: string
          name: string
          ord?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          mission_id?: string
          name?: string
          ord?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_capabilities_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_app_links: {
        Row: {
          application_id: string
          capability_id: string
          created_at: string
          id: string
          role: string | null
          source_system_id: string | null
        }
        Insert: {
          application_id: string
          capability_id: string
          created_at?: string
          id?: string
          role?: string | null
          source_system_id?: string | null
        }
        Update: {
          application_id?: string
          capability_id?: string
          created_at?: string
          id?: string
          role?: string | null
          source_system_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capability_app_links_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "argus_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_app_links_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "business_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capability_app_links_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_chart_configs: {
        Row: {
          chart_type: string
          created_at: string | null
          display_order: number | null
          enabled: boolean
          id: string
          label: string | null
          pack_slug: string
        }
        Insert: {
          chart_type: string
          created_at?: string | null
          display_order?: number | null
          enabled?: boolean
          id?: string
          label?: string | null
          pack_slug: string
        }
        Update: {
          chart_type?: string
          created_at?: string | null
          display_order?: number | null
          enabled?: boolean
          id?: string
          label?: string | null
          pack_slug?: string
        }
        Relationships: []
      }
      causal_rules: {
        Row: {
          cause_attribute: string | null
          cause_object: string | null
          code: string
          confidence: number | null
          created_at: string
          direction: string | null
          domain: string
          effect_attribute: string | null
          effect_object: string | null
          id: string
          is_active: boolean | null
          mission_id: string | null
          operator: string | null
          rationale: string
          rule_type: string
          sector: string
          source: string | null
          threshold: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cause_attribute?: string | null
          cause_object?: string | null
          code: string
          confidence?: number | null
          created_at?: string
          direction?: string | null
          domain: string
          effect_attribute?: string | null
          effect_object?: string | null
          id?: string
          is_active?: boolean | null
          mission_id?: string | null
          operator?: string | null
          rationale: string
          rule_type?: string
          sector?: string
          source?: string | null
          threshold?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cause_attribute?: string | null
          cause_object?: string | null
          code?: string
          confidence?: number | null
          created_at?: string
          direction?: string | null
          domain?: string
          effect_attribute?: string | null
          effect_object?: string | null
          id?: string
          is_active?: boolean | null
          mission_id?: string | null
          operator?: string | null
          rationale?: string
          rule_type?: string
          sector?: string
          source?: string | null
          threshold?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "causal_rules_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_avis: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          levee: boolean
          nom: string
          position: string
          reserve: string | null
          role: string | null
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          levee?: boolean
          nom: string
          position: string
          reserve?: string | null
          role?: string | null
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          levee?: boolean
          nom?: string
          position?: string
          reserve?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combo_avis_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "tracked_combos"
            referencedColumns: ["id"]
          },
        ]
      }
      comex_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          decision_id: string | null
          decisions_log: Json
          dissensus: Json
          id: string
          mission_id: string | null
          pack_slug: string | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          decision_id?: string | null
          decisions_log?: Json
          dissensus?: Json
          id?: string
          mission_id?: string | null
          pack_slug?: string | null
          scheduled_at?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          decision_id?: string | null
          decisions_log?: Json
          dissensus?: Json
          id?: string
          mission_id?: string | null
          pack_slug?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comex_sessions_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comex_sessions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      connectors_catalog: {
        Row: {
          access_technique: string
          category: string
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          position: number
          slug: string
          status: string
          tier: number
          trust_tier: string
          updated_at: string
        }
        Insert: {
          access_technique: string
          category: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          position?: number
          slug: string
          status?: string
          tier?: number
          trust_tier?: string
          updated_at?: string
        }
        Update: {
          access_technique?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          position?: number
          slug?: string
          status?: string
          tier?: number
          trust_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      crisis_events: {
        Row: {
          communications: Json
          confidentiality: Database["public"]["Enums"]["confidentiality_level"]
          created_at: string | null
          id: string
          log: Json
          mission_id: string | null
          protocol: Json
          resolved_at: string | null
          severity: string
          status: string
          title: string
          triggered_at: string | null
        }
        Insert: {
          communications?: Json
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string | null
          id?: string
          log?: Json
          mission_id?: string | null
          protocol?: Json
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          triggered_at?: string | null
        }
        Update: {
          communications?: Json
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string | null
          id?: string
          log?: Json
          mission_id?: string | null
          protocol?: Json
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crisis_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_contracts: {
        Row: {
          business_owner: string | null
          business_question: string | null
          confidence_threshold: number | null
          created_at: string
          decision_id: string | null
          decision_owner: string | null
          expected_sources: string[]
          freshness_sla_minutes: number | null
          id: string
          notes: string | null
          pack_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_owner?: string | null
          business_question?: string | null
          confidence_threshold?: number | null
          created_at?: string
          decision_id?: string | null
          decision_owner?: string | null
          expected_sources?: string[]
          freshness_sla_minutes?: number | null
          id?: string
          notes?: string | null
          pack_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_owner?: string | null
          business_question?: string | null
          confidence_threshold?: number | null
          created_at?: string
          decision_id?: string | null
          decision_owner?: string | null
          expected_sources?: string[]
          freshness_sla_minutes?: number | null
          id?: string
          notes?: string | null
          pack_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_contracts_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_coverage"
            referencedColumns: ["decision_id"]
          },
          {
            foreignKeyName: "decision_contracts_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "pack_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_contracts_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_criteria: {
        Row: {
          created_at: string
          decision_id: string
          description: string | null
          id: string
          name: string
          position: number
          required_confidence: number
          weight: number
        }
        Insert: {
          created_at?: string
          decision_id: string
          description?: string | null
          id?: string
          name: string
          position?: number
          required_confidence?: number
          weight?: number
        }
        Update: {
          created_at?: string
          decision_id?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          required_confidence?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "decision_criteria_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_coverage"
            referencedColumns: ["decision_id"]
          },
          {
            foreignKeyName: "decision_criteria_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "pack_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_esg_impacts: {
        Row: {
          created_at: string | null
          decision_id: string | null
          delta: number
          id: string
          metric_id: string | null
          pack_slug: string | null
          rationale: string | null
        }
        Insert: {
          created_at?: string | null
          decision_id?: string | null
          delta?: number
          id?: string
          metric_id?: string | null
          pack_slug?: string | null
          rationale?: string | null
        }
        Update: {
          created_at?: string | null
          decision_id?: string | null
          delta?: number
          id?: string
          metric_id?: string | null
          pack_slug?: string | null
          rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_esg_impacts_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_esg_impacts_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "esg_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_outcomes: {
        Row: {
          actual: Json
          created_at: string | null
          created_by: string | null
          decision_id: string | null
          delta_summary: string | null
          id: string
          lessons: string | null
          pack_slug: string | null
          predicted: Json
          reviewed_at: string | null
        }
        Insert: {
          actual?: Json
          created_at?: string | null
          created_by?: string | null
          decision_id?: string | null
          delta_summary?: string | null
          id?: string
          lessons?: string | null
          pack_slug?: string | null
          predicted?: Json
          reviewed_at?: string | null
        }
        Update: {
          actual?: Json
          created_at?: string | null
          created_by?: string | null
          decision_id?: string | null
          delta_summary?: string | null
          id?: string
          lessons?: string | null
          pack_slug?: string | null
          predicted?: Json
          reviewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_outcomes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_packs: {
        Row: {
          business_question: string | null
          capabilities: string[]
          category: string
          confidentiality: Database["public"]["Enums"]["confidentiality_level"]
          created_at: string
          criteria_interactions: Json | null
          decision_criteria: Json | null
          decision_options: Json
          decision_question: string | null
          description: string
          engines: string[]
          expected_outcome: Json | null
          family: string | null
          icon: string
          id: string
          is_published: boolean
          is_universal: boolean
          kpis: string[]
          observed_outcome: Json | null
          owner_role: string | null
          slug: string
          tier: string | null
          title: string
        }
        Insert: {
          business_question?: string | null
          capabilities?: string[]
          category: string
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string
          criteria_interactions?: Json | null
          decision_criteria?: Json | null
          decision_options?: Json
          decision_question?: string | null
          description: string
          engines?: string[]
          expected_outcome?: Json | null
          family?: string | null
          icon?: string
          id?: string
          is_published?: boolean
          is_universal?: boolean
          kpis?: string[]
          observed_outcome?: Json | null
          owner_role?: string | null
          slug: string
          tier?: string | null
          title: string
        }
        Update: {
          business_question?: string | null
          capabilities?: string[]
          category?: string
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string
          criteria_interactions?: Json | null
          decision_criteria?: Json | null
          decision_options?: Json
          decision_question?: string | null
          description?: string
          engines?: string[]
          expected_outcome?: Json | null
          family?: string | null
          icon?: string
          id?: string
          is_published?: boolean
          is_universal?: boolean
          kpis?: string[]
          observed_outcome?: Json | null
          owner_role?: string | null
          slug?: string
          tier?: string | null
          title?: string
        }
        Relationships: []
      }
      decision_recommendation_actions: {
        Row: {
          actual_impact_label: string | null
          committed_at: string | null
          committed_by: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          outcome_notes: string | null
          outcome_rating: number | null
          recommendation_id: string | null
          signal_id: string | null
          status: string
          target_date: string | null
          updated_at: string | null
        }
        Insert: {
          actual_impact_label?: string | null
          committed_at?: string | null
          committed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          outcome_notes?: string | null
          outcome_rating?: number | null
          recommendation_id?: string | null
          signal_id?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_impact_label?: string | null
          committed_at?: string | null
          committed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          outcome_notes?: string | null
          outcome_rating?: number | null
          recommendation_id?: string | null
          signal_id?: string | null
          status?: string
          target_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_recommendation_actions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "decision_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_recommendation_actions_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_recommendations: {
        Row: {
          action_steps: Json | null
          confidence_pct: number | null
          confidence_score: number | null
          created_at: string | null
          description: string | null
          effort_level: string | null
          explanation: string | null
          feasibility_score: number
          id: string
          impact_estimate_label: string | null
          impact_score: number
          pack_id: string | null
          priority_score: number | null
          signal_code: string
          time_to_impact: string | null
          title: string
        }
        Insert: {
          action_steps?: Json | null
          confidence_pct?: number | null
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          effort_level?: string | null
          explanation?: string | null
          feasibility_score: number
          id?: string
          impact_estimate_label?: string | null
          impact_score: number
          pack_id?: string | null
          priority_score?: number | null
          signal_code: string
          time_to_impact?: string | null
          title: string
        }
        Update: {
          action_steps?: Json | null
          confidence_pct?: number | null
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          effort_level?: string | null
          explanation?: string | null
          feasibility_score?: number
          id?: string
          impact_estimate_label?: string | null
          impact_score?: number
          pack_id?: string | null
          priority_score?: number | null
          signal_code?: string
          time_to_impact?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_recommendations_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_reviews: {
        Row: {
          answered_at: string | null
          chosen_option: string | null
          created_at: string
          decision_ref: string | null
          due_at: string
          horizon_label: string | null
          id: string
          org_id: string | null
          reminded_at: string | null
          space: string
          status: string
          title: string
          updated_at: string
          user_id: string
          verdict: string | null
          verdict_comment: string | null
        }
        Insert: {
          answered_at?: string | null
          chosen_option?: string | null
          created_at?: string
          decision_ref?: string | null
          due_at: string
          horizon_label?: string | null
          id?: string
          org_id?: string | null
          reminded_at?: string | null
          space?: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string
          verdict?: string | null
          verdict_comment?: string | null
        }
        Update: {
          answered_at?: string | null
          chosen_option?: string | null
          created_at?: string
          decision_ref?: string | null
          due_at?: string
          horizon_label?: string | null
          id?: string
          org_id?: string | null
          reminded_at?: string | null
          space?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          verdict?: string | null
          verdict_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_scenarios: {
        Row: {
          assumptions: Json
          confidence: number | null
          created_at: string
          criteria: Json
          decision_id: string | null
          id: string
          options: Json
          pack_id: string | null
          published_at: string | null
          question: string
          recommendation: string | null
          scoring: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json
          confidence?: number | null
          created_at?: string
          criteria?: Json
          decision_id?: string | null
          id?: string
          options?: Json
          pack_id?: string | null
          published_at?: string | null
          question: string
          recommendation?: string | null
          scoring?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json
          confidence?: number | null
          created_at?: string
          criteria?: Json
          decision_id?: string | null
          id?: string
          options?: Json
          pack_id?: string | null
          published_at?: string | null
          question?: string
          recommendation?: string | null
          scoring?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_scenarios_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_scenarios_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_templates: {
        Row: {
          assumptions: Json
          complexity: string
          created_at: string
          criteria: Json
          default_question: string
          description: string
          family: string
          horizon_months: number
          id: string
          kpi_hints: Json
          methodology: string
          name: string
          position: number
          recommended_sources: Json
          slug: string
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          complexity?: string
          created_at?: string
          criteria?: Json
          default_question: string
          description: string
          family: string
          horizon_months?: number
          id?: string
          kpi_hints?: Json
          methodology: string
          name: string
          position?: number
          recommended_sources?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          complexity?: string
          created_at?: string
          criteria?: Json
          default_question?: string
          description?: string
          family?: string
          horizon_months?: number
          id?: string
          kpi_hints?: Json
          methodology?: string
          name?: string
          position?: number
          recommended_sources?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          confidentiality: Database["public"]["Enums"]["confidentiality_level"]
          created_at: string
          id: string
          messages: Json
          pack_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string
          id?: string
          messages?: Json
          pack_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string
          id?: string
          messages?: Json
          pack_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      ea_app_catalog: {
        Row: {
          annual_cost_eur: number | null
          app_label: string
          app_local_id: string | null
          created_at: string
          criticality: Database["public"]["Enums"]["ea_criticality"] | null
          ea_object_id: string | null
          end_of_life_on: string | null
          hosting: string | null
          id: string
          lifecycle: Database["public"]["Enums"]["ea_lifecycle"]
          notes: string | null
          owner_email: string | null
          owner_label: string | null
          study_id: string | null
          tech_obsolescence_years: number | null
          updated_at: string
          user_id: string
          users_count: number | null
        }
        Insert: {
          annual_cost_eur?: number | null
          app_label: string
          app_local_id?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["ea_criticality"] | null
          ea_object_id?: string | null
          end_of_life_on?: string | null
          hosting?: string | null
          id?: string
          lifecycle?: Database["public"]["Enums"]["ea_lifecycle"]
          notes?: string | null
          owner_email?: string | null
          owner_label?: string | null
          study_id?: string | null
          tech_obsolescence_years?: number | null
          updated_at?: string
          user_id?: string
          users_count?: number | null
        }
        Update: {
          annual_cost_eur?: number | null
          app_label?: string
          app_local_id?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["ea_criticality"] | null
          ea_object_id?: string | null
          end_of_life_on?: string | null
          hosting?: string | null
          id?: string
          lifecycle?: Database["public"]["Enums"]["ea_lifecycle"]
          notes?: string | null
          owner_email?: string | null
          owner_label?: string | null
          study_id?: string | null
          tech_obsolescence_years?: number | null
          updated_at?: string
          user_id?: string
          users_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ea_app_catalog_ea_object_id_fkey"
            columns: ["ea_object_id"]
            isOneToOne: false
            referencedRelation: "ea_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      ea_approvals: {
        Row: {
          action: Database["public"]["Enums"]["ea_approval_action"]
          actor_label: string
          comment: string | null
          created_at: string
          id: string
          subject_id: string
          subject_label: string | null
          subject_type: string
          subject_version: number | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["ea_approval_action"]
          actor_label: string
          comment?: string | null
          created_at?: string
          id?: string
          subject_id: string
          subject_label?: string | null
          subject_type: string
          subject_version?: number | null
          user_id?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["ea_approval_action"]
          actor_label?: string
          comment?: string | null
          created_at?: string
          id?: string
          subject_id?: string
          subject_label?: string | null
          subject_type?: string
          subject_version?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ea_arch_versions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          gap: Json
          id: string
          label: string
          snapshot: Json
          status: Database["public"]["Enums"]["ea_approval_action"] | null
          study_id: string
          study_title: string | null
          submitted_by: string | null
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          gap?: Json
          id?: string
          label: string
          snapshot: Json
          status?: Database["public"]["Enums"]["ea_approval_action"] | null
          study_id: string
          study_title?: string | null
          submitted_by?: string | null
          user_id?: string
          version: number
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          gap?: Json
          id?: string
          label?: string
          snapshot?: Json
          status?: Database["public"]["Enums"]["ea_approval_action"] | null
          study_id?: string
          study_title?: string | null
          submitted_by?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      ea_gap_log: {
        Row: {
          apps_as_is: number
          apps_cible: number
          apps_nouvelles: number
          capacites_non_rattachees: number
          created_at: string
          detail: Json
          exigences_sans_besoin: number
          id: string
          l4_nouvelles: number
          observed_at: string
          study_id: string
          user_id: string
        }
        Insert: {
          apps_as_is?: number
          apps_cible?: number
          apps_nouvelles?: number
          capacites_non_rattachees?: number
          created_at?: string
          detail?: Json
          exigences_sans_besoin?: number
          id?: string
          l4_nouvelles?: number
          observed_at?: string
          study_id: string
          user_id?: string
        }
        Update: {
          apps_as_is?: number
          apps_cible?: number
          apps_nouvelles?: number
          capacites_non_rattachees?: number
          created_at?: string
          detail?: Json
          exigences_sans_besoin?: number
          id?: string
          l4_nouvelles?: number
          observed_at?: string
          study_id?: string
          user_id?: string
        }
        Relationships: []
      }
      ea_object_versions: {
        Row: {
          change_note: string | null
          changed_by: string | null
          created_at: string
          id: string
          object_id: string
          snapshot: Json
          user_id: string
          version: number
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          object_id: string
          snapshot: Json
          user_id?: string
          version: number
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          object_id?: string
          snapshot?: Json
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ea_object_versions_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "ea_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      ea_objects: {
        Row: {
          attributes: Json
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["ea_object_kind"]
          label: string
          lifecycle: Database["public"]["Enums"]["ea_lifecycle"]
          object_key: string
          org_id: string | null
          owner_label: string | null
          retired_at: string | null
          source_refs: Json
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
          version: number
        }
        Insert: {
          attributes?: Json
          created_at?: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["ea_object_kind"]
          label: string
          lifecycle?: Database["public"]["Enums"]["ea_lifecycle"]
          object_key: string
          org_id?: string | null
          owner_label?: string | null
          retired_at?: string | null
          source_refs?: Json
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          version?: number
        }
        Update: {
          attributes?: Json
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ea_object_kind"]
          label?: string
          lifecycle?: Database["public"]["Enums"]["ea_lifecycle"]
          object_key?: string
          org_id?: string | null
          owner_label?: string | null
          retired_at?: string | null
          source_refs?: Json
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ea_objects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ea_value_links: {
        Row: {
          baseline_value: number | null
          besoin_ids: string[]
          created_at: string
          delivered_at: string | null
          exigence_ids: string[]
          feature_key: string
          feature_label: string | null
          id: string
          kpi_key: string
          kpi_label: string
          kpi_unit: string | null
          notes: string | null
          observed_at: string | null
          observed_source: string | null
          observed_value: number | null
          story_id: string | null
          story_text: string | null
          study_id: string
          target_value: number | null
          updated_at: string
          user_id: string
          verdict: Database["public"]["Enums"]["ea_value_verdict"]
        }
        Insert: {
          baseline_value?: number | null
          besoin_ids?: string[]
          created_at?: string
          delivered_at?: string | null
          exigence_ids?: string[]
          feature_key: string
          feature_label?: string | null
          id?: string
          kpi_key: string
          kpi_label: string
          kpi_unit?: string | null
          notes?: string | null
          observed_at?: string | null
          observed_source?: string | null
          observed_value?: number | null
          story_id?: string | null
          story_text?: string | null
          study_id: string
          target_value?: number | null
          updated_at?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["ea_value_verdict"]
        }
        Update: {
          baseline_value?: number | null
          besoin_ids?: string[]
          created_at?: string
          delivered_at?: string | null
          exigence_ids?: string[]
          feature_key?: string
          feature_label?: string | null
          id?: string
          kpi_key?: string
          kpi_label?: string
          kpi_unit?: string | null
          notes?: string | null
          observed_at?: string | null
          observed_source?: string | null
          observed_value?: number | null
          story_id?: string | null
          story_text?: string | null
          study_id?: string
          target_value?: number | null
          updated_at?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["ea_value_verdict"]
        }
        Relationships: []
      }
      esg_metrics: {
        Row: {
          baseline: number | null
          category: string
          created_at: string | null
          current_value: number | null
          id: string
          name: string
          period: string | null
          target: number | null
          unit: string | null
        }
        Insert: {
          baseline?: number | null
          category?: string
          created_at?: string | null
          current_value?: number | null
          id?: string
          name: string
          period?: string | null
          target?: number | null
          unit?: string | null
        }
        Update: {
          baseline?: number | null
          category?: string
          created_at?: string | null
          current_value?: number | null
          id?: string
          name?: string
          period?: string | null
          target?: number | null
          unit?: string | null
        }
        Relationships: []
      }
      extraction_contracts: {
        Row: {
          access_method: string | null
          attribute_id: string | null
          cache_ttl_minutes: number | null
          candidate_sources: Json
          completeness_target: number | null
          confidence_score: number | null
          created_at: string
          decision_contract_id: string
          evidence: Json
          freshness_target_minutes: number | null
          id: string
          last_run_at: string | null
          last_value_sample: Json | null
          mapping_confidence: number | null
          notes: string | null
          object_id: string
          preferred_source: string | null
          refresh_interval_minutes: number | null
          refresh_policy: string | null
          retention_days: number | null
          source_field: string | null
          source_system: string | null
          status: string
          suggested_argus_schema_id: string | null
          transformation_rules: Json
          updated_at: string
          validation_status: string
        }
        Insert: {
          access_method?: string | null
          attribute_id?: string | null
          cache_ttl_minutes?: number | null
          candidate_sources?: Json
          completeness_target?: number | null
          confidence_score?: number | null
          created_at?: string
          decision_contract_id: string
          evidence?: Json
          freshness_target_minutes?: number | null
          id?: string
          last_run_at?: string | null
          last_value_sample?: Json | null
          mapping_confidence?: number | null
          notes?: string | null
          object_id: string
          preferred_source?: string | null
          refresh_interval_minutes?: number | null
          refresh_policy?: string | null
          retention_days?: number | null
          source_field?: string | null
          source_system?: string | null
          status?: string
          suggested_argus_schema_id?: string | null
          transformation_rules?: Json
          updated_at?: string
          validation_status?: string
        }
        Update: {
          access_method?: string | null
          attribute_id?: string | null
          cache_ttl_minutes?: number | null
          candidate_sources?: Json
          completeness_target?: number | null
          confidence_score?: number | null
          created_at?: string
          decision_contract_id?: string
          evidence?: Json
          freshness_target_minutes?: number | null
          id?: string
          last_run_at?: string | null
          last_value_sample?: Json | null
          mapping_confidence?: number | null
          notes?: string | null
          object_id?: string
          preferred_source?: string | null
          refresh_interval_minutes?: number | null
          refresh_policy?: string | null
          retention_days?: number | null
          source_field?: string | null
          source_system?: string | null
          status?: string
          suggested_argus_schema_id?: string | null
          transformation_rules?: Json
          updated_at?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_contracts_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "semantic_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_contracts_decision_contract_id_fkey"
            columns: ["decision_contract_id"]
            isOneToOne: false
            referencedRelation: "decision_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_contracts_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "semantic_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_contracts_suggested_argus_schema_id_fkey"
            columns: ["suggested_argus_schema_id"]
            isOneToOne: false
            referencedRelation: "argus_schemas"
            referencedColumns: ["id"]
          },
        ]
      }
      facts: {
        Row: {
          attribute_id: string | null
          attribute_name: string | null
          confidence: number
          created_at: string
          entity_key: string | null
          extraction_contract_id: string | null
          freshness: string | null
          id: string
          lineage: Json
          mission_id: string | null
          object_id: string | null
          object_name: string
          observed_at: string
          raw_payload: Json | null
          semantic_role: string | null
          source_app: string | null
          source_endpoint: string | null
          source_system_id: string | null
          stale_at: string | null
          value_jsonb: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          attribute_id?: string | null
          attribute_name?: string | null
          confidence?: number
          created_at?: string
          entity_key?: string | null
          extraction_contract_id?: string | null
          freshness?: string | null
          id?: string
          lineage?: Json
          mission_id?: string | null
          object_id?: string | null
          object_name: string
          observed_at?: string
          raw_payload?: Json | null
          semantic_role?: string | null
          source_app?: string | null
          source_endpoint?: string | null
          source_system_id?: string | null
          stale_at?: string | null
          value_jsonb?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          attribute_id?: string | null
          attribute_name?: string | null
          confidence?: number
          created_at?: string
          entity_key?: string | null
          extraction_contract_id?: string | null
          freshness?: string | null
          id?: string
          lineage?: Json
          mission_id?: string | null
          object_id?: string | null
          object_name?: string
          observed_at?: string
          raw_payload?: Json | null
          semantic_role?: string | null
          source_app?: string | null
          source_endpoint?: string | null
          source_system_id?: string | null
          stale_at?: string | null
          value_jsonb?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facts_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "semantic_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_extraction_contract_id_fkey"
            columns: ["extraction_contract_id"]
            isOneToOne: false
            referencedRelation: "extraction_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "semantic_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facts_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      field_briefs: {
        Row: {
          created_at: string | null
          id: string
          key_actions: Json
          kpis: Json
          pack_slug: string | null
          summary: string | null
          target_role: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_actions?: Json
          kpis?: Json
          pack_slug?: string | null
          summary?: string | null
          target_role: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key_actions?: Json
          kpis?: Json
          pack_slug?: string | null
          summary?: string | null
          target_role?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ia_readiness_dimensions: {
        Row: {
          created_at: string
          dimension: string
          evidences: Json | null
          id: string
          label: string
          maturity_level: string | null
          mission_id: string
          observations: string | null
          ord: number | null
          priority: string | null
          rationale: string | null
          recommendations: Json | null
          score: number
          target_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension: string
          evidences?: Json | null
          id?: string
          label: string
          maturity_level?: string | null
          mission_id: string
          observations?: string | null
          ord?: number | null
          priority?: string | null
          rationale?: string | null
          recommendations?: Json | null
          score: number
          target_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension?: string
          evidences?: Json | null
          id?: string
          label?: string
          maturity_level?: string | null
          mission_id?: string
          observations?: string | null
          ord?: number | null
          priority?: string | null
          rationale?: string | null
          recommendations?: Json | null
          score?: number
          target_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_readiness_dimensions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_readiness_roadmap: {
        Row: {
          created_at: string
          dependencies: string[] | null
          description: string | null
          duration_months: number | null
          effort: string | null
          expected_gains: string | null
          id: string
          kpis: Json | null
          mission_id: string
          ord: number | null
          start_month: number | null
          status: string | null
          title: string
          updated_at: string
          wave: number
        }
        Insert: {
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          duration_months?: number | null
          effort?: string | null
          expected_gains?: string | null
          id?: string
          kpis?: Json | null
          mission_id: string
          ord?: number | null
          start_month?: number | null
          status?: string | null
          title: string
          updated_at?: string
          wave: number
        }
        Update: {
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          duration_months?: number | null
          effort?: string | null
          expected_gains?: string | null
          id?: string
          kpis?: Json | null
          mission_id?: string
          ord?: number | null
          start_month?: number | null
          status?: string | null
          title?: string
          updated_at?: string
          wave?: number
        }
        Relationships: [
          {
            foreignKeyName: "ia_readiness_roadmap_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      information_assets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          known_source_status: string
          mission_id: string | null
          name: string
          notes: string | null
          owner: string | null
          tool: string | null
          updated_at: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          id?: string
          known_source_status?: string
          mission_id?: string | null
          name: string
          notes?: string | null
          owner?: string | null
          tool?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          known_source_status?: string
          mission_id?: string | null
          name?: string
          notes?: string | null
          owner?: string | null
          tool?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "information_assets_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_question_bank: {
        Row: {
          created_at: string
          dimension: string
          hint: string | null
          id: string
          ord: number | null
          question: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension: string
          hint?: string | null
          id?: string
          ord?: number | null
          question: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension?: string
          hint?: string | null
          id?: string
          ord?: number | null
          question?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      interview_templates: {
        Row: {
          created_at: string
          description: string | null
          duration_min: number | null
          expected_outputs: Json | null
          id: string
          phase: string
          position: number | null
          question_bank: Json
          role_target: string
          sector: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          expected_outputs?: Json | null
          id?: string
          phase?: string
          position?: number | null
          question_bank?: Json
          role_target: string
          sector?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          expected_outputs?: Json | null
          id?: string
          phase?: string
          position?: number | null
          question_bank?: Json
          role_target?: string
          sector?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ma_synergies: {
        Row: {
          category: string
          confidence: number | null
          created_at: string | null
          id: string
          notes: string | null
          realization_months: number | null
          target_id: string | null
          value_eur: number | null
        }
        Insert: {
          category: string
          confidence?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          realization_months?: number | null
          target_id?: string | null
          value_eur?: number | null
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          realization_months?: number | null
          target_id?: string | null
          value_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ma_synergies_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ma_targets"
            referencedColumns: ["id"]
          },
        ]
      }
      ma_targets: {
        Row: {
          confidentiality: Database["public"]["Enums"]["confidentiality_level"]
          country: string | null
          created_at: string | null
          ebitda: number | null
          ebitda_multiple: number | null
          fit_score: number | null
          id: string
          mission_id: string | null
          name: string
          notes: string | null
          project_id: string | null
          revenue: number | null
          sector: string | null
          stage: string
        }
        Insert: {
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          country?: string | null
          created_at?: string | null
          ebitda?: number | null
          ebitda_multiple?: number | null
          fit_score?: number | null
          id?: string
          mission_id?: string | null
          name: string
          notes?: string | null
          project_id?: string | null
          revenue?: number | null
          sector?: string | null
          stage?: string
        }
        Update: {
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          country?: string | null
          created_at?: string | null
          ebitda?: number | null
          ebitda_multiple?: number | null
          fit_score?: number | null
          id?: string
          mission_id?: string | null
          name?: string
          notes?: string | null
          project_id?: string | null
          revenue?: number | null
          sector?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "ma_targets_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ma_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_interviews: {
        Row: {
          application_ref: string | null
          apps_mentioned: string[] | null
          channel: string | null
          created_at: string
          duration_min: number | null
          extracted: Json
          face_to_face_notes: string | null
          id: string
          interview_date: string | null
          interview_type: string
          interviewee_department: string | null
          interviewee_name: string
          interviewee_role: string
          key_verbatims: Json | null
          meeting_report: string | null
          mission_id: string
          opportunities: Json | null
          pain_points: Json | null
          proposed_synthesis: Json | null
          qa_pairs: Json
          summary: string | null
          synthesis_validated: boolean
          transcript: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          application_ref?: string | null
          apps_mentioned?: string[] | null
          channel?: string | null
          created_at?: string
          duration_min?: number | null
          extracted?: Json
          face_to_face_notes?: string | null
          id?: string
          interview_date?: string | null
          interview_type?: string
          interviewee_department?: string | null
          interviewee_name: string
          interviewee_role: string
          key_verbatims?: Json | null
          meeting_report?: string | null
          mission_id: string
          opportunities?: Json | null
          pain_points?: Json | null
          proposed_synthesis?: Json | null
          qa_pairs?: Json
          summary?: string | null
          synthesis_validated?: boolean
          transcript?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          application_ref?: string | null
          apps_mentioned?: string[] | null
          channel?: string | null
          created_at?: string
          duration_min?: number | null
          extracted?: Json
          face_to_face_notes?: string | null
          id?: string
          interview_date?: string | null
          interview_type?: string
          interviewee_department?: string | null
          interviewee_name?: string
          interviewee_role?: string
          key_verbatims?: Json | null
          meeting_report?: string | null
          mission_id?: string
          opportunities?: Json | null
          pain_points?: Json | null
          proposed_synthesis?: Json | null
          qa_pairs?: Json
          summary?: string | null
          synthesis_validated?: boolean
          transcript?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_interviews_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_sections: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          mission_id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          mission_id: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          mission_id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_sections_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          client_name: string
          context: string | null
          created_at: string
          id: string
          org_id: string | null
          owner_id: string
          phase: string
          sector: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_name: string
          context?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          owner_id: string
          phase?: string
          sector?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          context?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          owner_id?: string
          phase?: string
          sector?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_decision_links: {
        Row: {
          created_at: string | null
          decision_id: string | null
          id: string
          impact_weight: number | null
          okr_id: string | null
          pack_slug: string | null
        }
        Insert: {
          created_at?: string | null
          decision_id?: string | null
          id?: string
          impact_weight?: number | null
          okr_id?: string | null
          pack_slug?: string | null
        }
        Update: {
          created_at?: string | null
          decision_id?: string | null
          id?: string
          impact_weight?: number | null
          okr_id?: string | null
          pack_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "okr_decision_links_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_decision_links_okr_id_fkey"
            columns: ["okr_id"]
            isOneToOne: false
            referencedRelation: "okrs"
            referencedColumns: ["id"]
          },
        ]
      }
      okrs: {
        Row: {
          confidentiality: Database["public"]["Enums"]["confidentiality_level"]
          created_at: string | null
          id: string
          key_results: Json
          mission_id: string | null
          objective: string
          owner: string | null
          period: string | null
          progress: number | null
          updated_at: string | null
        }
        Insert: {
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string | null
          id?: string
          key_results?: Json
          mission_id?: string | null
          objective: string
          owner?: string | null
          period?: string | null
          progress?: number | null
          updated_at?: string | null
        }
        Update: {
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string | null
          id?: string
          key_results?: Json
          mission_id?: string | null
          objective?: string
          owner?: string | null
          period?: string | null
          progress?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "okrs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          revoked_at: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          revoked_at?: string | null
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          invited_at: string
          joined_at: string | null
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          invited_at?: string
          joined_at?: string | null
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          invited_at?: string
          joined_at?: string | null
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          max_missions: number
          max_users: number
          name: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_missions?: number
          max_users?: number
          name: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_missions?: number
          max_users?: number
          name?: string
          plan?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pack_capabilities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          pack_id: string
          position: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          pack_id: string
          position?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          pack_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pack_capabilities_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_decisions: {
        Row: {
          capability_id: string | null
          created_at: string
          criticality: string
          description: string | null
          id: string
          name: string
          owner_role: string | null
          pack_id: string
          position: number
          updated_at: string
        }
        Insert: {
          capability_id?: string | null
          created_at?: string
          criticality?: string
          description?: string | null
          id?: string
          name: string
          owner_role?: string | null
          pack_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          capability_id?: string | null
          created_at?: string
          criticality?: string
          description?: string | null
          id?: string
          name?: string
          owner_role?: string | null
          pack_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_decisions_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "pack_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_decisions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          capabilities: string[]
          category: string | null
          created_at: string
          decision_question: string | null
          description: string | null
          icon: string | null
          id: string
          is_published: boolean
          is_universal: boolean
          kpis: string[]
          owner_role: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          category?: string | null
          created_at?: string
          decision_question?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          is_universal?: boolean
          kpis?: string[]
          owner_role?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          category?: string | null
          created_at?: string
          decision_question?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          is_universal?: boolean
          kpis?: string[]
          owner_role?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_name: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          org_name?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_name?: string | null
        }
        Relationships: []
      }
      project_application_impacts: {
        Row: {
          application_id: string
          created_at: string
          id: string
          impact_level: number
          impact_type: string
          notes: string | null
          project_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          impact_level?: number
          impact_type?: string
          notes?: string | null
          project_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          impact_level?: number
          impact_type?: string
          notes?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_application_impacts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "argus_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_application_impacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_application_impacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_capability_impacts: {
        Row: {
          capability_id: string
          created_at: string
          id: string
          impact_level: number
          impact_type: string
          notes: string | null
          project_id: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          id?: string
          impact_level?: number
          impact_type?: string
          notes?: string | null
          project_id: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          id?: string
          impact_level?: number
          impact_type?: string
          notes?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_capability_impacts_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "pack_capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_capability_impacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_capability_impacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_dependencies: {
        Row: {
          created_at: string
          dep_type: string
          depends_on_project_id: string
          id: string
          notes: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          dep_type?: string
          depends_on_project_id: string
          id?: string
          notes?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          dep_type?: string
          depends_on_project_id?: string
          id?: string
          notes?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_dependencies_depends_on_project_id_fkey"
            columns: ["depends_on_project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_dependencies_depends_on_project_id_fkey"
            columns: ["depends_on_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_dependencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_dependencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          name: string
          notes: string | null
          position: number
          project_id: string
          status: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          position?: number
          project_id: string
          status?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          position?: number
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pack_impacts: {
        Row: {
          business_value_eur: number | null
          confidence_lift: number
          created_at: string
          decision_lift: number
          id: string
          notes: string | null
          pack_id: string
          project_id: string
        }
        Insert: {
          business_value_eur?: number | null
          confidence_lift?: number
          created_at?: string
          decision_lift?: number
          id?: string
          notes?: string | null
          pack_id: string
          project_id: string
        }
        Update: {
          business_value_eur?: number | null
          confidence_lift?: number
          created_at?: string
          decision_lift?: number
          id?: string
          notes?: string | null
          pack_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_pack_impacts_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_pack_impacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_pack_impacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_risks: {
        Row: {
          created_at: string
          id: string
          label: string
          likelihood: number
          mitigation: string | null
          project_id: string
          severity: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          likelihood?: number
          mitigation?: string | null
          project_id: string
          severity?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          likelihood?: number
          mitigation?: string | null
          project_id?: string
          severity?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_votes: {
        Row: {
          created_at: string
          id: string
          priority: number
          project_id: string
          support: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: number
          project_id: string
          support?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: number
          project_id?: string
          support?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_votes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_portfolio_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_votes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_eur: number | null
          category: string | null
          confidentiality: Database["public"]["Enums"]["confidentiality_level"]
          created_at: string
          description: string | null
          effort_score: number | null
          end_date: string | null
          expected_roi_eur: number | null
          id: string
          location: string | null
          mission_id: string
          name: string
          non_digital_metadata: Json | null
          owner_role: string | null
          phase: string
          project_type: string | null
          slug: string
          sponsor: string | null
          start_date: string | null
          status: string
          strategic_alignment: string | null
          tags: string[] | null
          updated_at: string
          value_score: number | null
        }
        Insert: {
          budget_eur?: number | null
          category?: string | null
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string
          description?: string | null
          effort_score?: number | null
          end_date?: string | null
          expected_roi_eur?: number | null
          id?: string
          location?: string | null
          mission_id: string
          name: string
          non_digital_metadata?: Json | null
          owner_role?: string | null
          phase?: string
          project_type?: string | null
          slug: string
          sponsor?: string | null
          start_date?: string | null
          status?: string
          strategic_alignment?: string | null
          tags?: string[] | null
          updated_at?: string
          value_score?: number | null
        }
        Update: {
          budget_eur?: number | null
          category?: string | null
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string
          description?: string | null
          effort_score?: number | null
          end_date?: string | null
          expected_roi_eur?: number | null
          id?: string
          location?: string | null
          mission_id?: string
          name?: string
          non_digital_metadata?: Json | null
          owner_role?: string | null
          phase?: string
          project_type?: string | null
          slug?: string
          sponsor?: string | null
          start_date?: string | null
          status?: string
          strategic_alignment?: string | null
          tags?: string[] | null
          updated_at?: string
          value_score?: number | null
        }
        Relationships: []
      }
      recommendation_effects: {
        Row: {
          description: string
          dimension: string
          direction: string
          id: string
          magnitude: number | null
          recommendation_id: string | null
        }
        Insert: {
          description: string
          dimension: string
          direction: string
          id?: string
          magnitude?: number | null
          recommendation_id?: string | null
        }
        Update: {
          description?: string
          dimension?: string
          direction?: string
          id?: string
          magnitude?: number | null
          recommendation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_effects_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "decision_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      red_team_analyses: {
        Row: {
          biases: Json
          blind_spots: Json
          confidence: number | null
          created_at: string | null
          created_by: string | null
          decision_id: string | null
          failure_modes: Json
          id: string
          mitigations: Json
          pack_slug: string | null
          question: string
        }
        Insert: {
          biases?: Json
          blind_spots?: Json
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          decision_id?: string | null
          failure_modes?: Json
          id?: string
          mitigations?: Json
          pack_slug?: string | null
          question: string
        }
        Update: {
          biases?: Json
          blind_spots?: Json
          confidence?: number | null
          created_at?: string | null
          created_by?: string | null
          decision_id?: string | null
          failure_modes?: Json
          id?: string
          mitigations?: Json
          pack_slug?: string | null
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_team_analyses_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      regulation_pack_impacts: {
        Row: {
          created_at: string | null
          effort: string | null
          id: string
          impact: string | null
          pack_slug: string
          regulation_id: string | null
        }
        Insert: {
          created_at?: string | null
          effort?: string | null
          id?: string
          impact?: string | null
          pack_slug: string
          regulation_id?: string | null
        }
        Update: {
          created_at?: string | null
          effort?: string | null
          id?: string
          impact?: string | null
          pack_slug?: string
          regulation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulation_pack_impacts_regulation_id_fkey"
            columns: ["regulation_id"]
            isOneToOne: false
            referencedRelation: "regulations"
            referencedColumns: ["id"]
          },
        ]
      }
      regulations: {
        Row: {
          created_at: string | null
          effective_date: string | null
          id: string
          jurisdiction: string | null
          name: string
          severity: string | null
          source_url: string | null
          status: string
          summary: string | null
          tags: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          jurisdiction?: string | null
          name: string
          severity?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
          tags?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string
          severity?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
          tags?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      report_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          mission_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          mission_id: string
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          mission_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_shares_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_decision_links: {
        Row: {
          created_at: string
          decision_id: string
          id: string
          rule_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          decision_id: string
          id?: string
          rule_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          decision_id?: string
          id?: string
          rule_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rule_decision_links_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_coverage"
            referencedColumns: ["decision_id"]
          },
          {
            foreignKeyName: "rule_decision_links_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "pack_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_decision_links_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "causal_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_interview_links: {
        Row: {
          created_at: string
          id: string
          interview_id: string
          quote: string | null
          rule_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          interview_id: string
          quote?: string | null
          rule_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          interview_id?: string
          quote?: string | null
          rule_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_interview_links_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "mission_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_interview_links_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "causal_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      section_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          phase: string
          position: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          phase?: string
          position?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          phase?: string
          position?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sector_overlays: {
        Row: {
          attribute_overrides: Json
          created_at: string
          decision_pack_id: string
          id: string
          notes: string | null
          sector: string
          sector_object: string
          universal_object: string
          updated_at: string
        }
        Insert: {
          attribute_overrides?: Json
          created_at?: string
          decision_pack_id: string
          id?: string
          notes?: string | null
          sector: string
          sector_object: string
          universal_object: string
          updated_at?: string
        }
        Update: {
          attribute_overrides?: Json
          created_at?: string
          decision_pack_id?: string
          id?: string
          notes?: string | null
          sector?: string
          sector_object?: string
          universal_object?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_overlays_decision_pack_id_fkey"
            columns: ["decision_pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_attributes: {
        Row: {
          attribute_name: string
          business_meaning: string | null
          calculation_rules: Json
          created_at: string
          data_type: string | null
          description: string | null
          example_value: string | null
          freshness: string | null
          id: string
          is_business_key: boolean
          is_required: boolean
          metric_definition: Json | null
          object_id: string
          position: number
          semantic_role: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          attribute_name: string
          business_meaning?: string | null
          calculation_rules?: Json
          created_at?: string
          data_type?: string | null
          description?: string | null
          example_value?: string | null
          freshness?: string | null
          id?: string
          is_business_key?: boolean
          is_required?: boolean
          metric_definition?: Json | null
          object_id: string
          position?: number
          semantic_role?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          attribute_name?: string
          business_meaning?: string | null
          calculation_rules?: Json
          created_at?: string
          data_type?: string | null
          description?: string | null
          example_value?: string | null
          freshness?: string | null
          id?: string
          is_business_key?: boolean
          is_required?: boolean
          metric_definition?: Json | null
          object_id?: string
          position?: number
          semantic_role?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semantic_attributes_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "semantic_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_object_relations: {
        Row: {
          cardinality: string | null
          created_at: string
          description: string | null
          from_object_id: string
          id: string
          pack_id: string
          relation_name: string
          to_object_id: string
          updated_at: string
        }
        Insert: {
          cardinality?: string | null
          created_at?: string
          description?: string | null
          from_object_id: string
          id?: string
          pack_id: string
          relation_name: string
          to_object_id: string
          updated_at?: string
        }
        Update: {
          cardinality?: string | null
          created_at?: string
          description?: string | null
          from_object_id?: string
          id?: string
          pack_id?: string
          relation_name?: string
          to_object_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semantic_object_relations_from_object_id_fkey"
            columns: ["from_object_id"]
            isOneToOne: false
            referencedRelation: "semantic_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semantic_object_relations_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semantic_object_relations_to_object_id_fkey"
            columns: ["to_object_id"]
            isOneToOne: false
            referencedRelation: "semantic_objects"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_objects: {
        Row: {
          aliases: Json
          business_key_attribute: string | null
          business_meaning: string | null
          business_states: Json
          concept: string | null
          created_at: string
          decision_id: string | null
          description: string | null
          freshness: string | null
          id: string
          identity_strategy: string | null
          is_kpi: boolean
          is_required: boolean
          object_name: string
          owner_team: string | null
          ownership_dimensions: Json
          pack_id: string
          position: number
          preferred_source_types: Json
          semantic_roles: Json
          updated_at: string
          variants: Json
        }
        Insert: {
          aliases?: Json
          business_key_attribute?: string | null
          business_meaning?: string | null
          business_states?: Json
          concept?: string | null
          created_at?: string
          decision_id?: string | null
          description?: string | null
          freshness?: string | null
          id?: string
          identity_strategy?: string | null
          is_kpi?: boolean
          is_required?: boolean
          object_name: string
          owner_team?: string | null
          ownership_dimensions?: Json
          pack_id: string
          position?: number
          preferred_source_types?: Json
          semantic_roles?: Json
          updated_at?: string
          variants?: Json
        }
        Update: {
          aliases?: Json
          business_key_attribute?: string | null
          business_meaning?: string | null
          business_states?: Json
          concept?: string | null
          created_at?: string
          decision_id?: string | null
          description?: string | null
          freshness?: string | null
          id?: string
          identity_strategy?: string | null
          is_kpi?: boolean
          is_required?: boolean
          object_name?: string
          owner_team?: string | null
          ownership_dimensions?: Json
          pack_id?: string
          position?: number
          preferred_source_types?: Json
          semantic_roles?: Json
          updated_at?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "semantic_objects_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_coverage"
            referencedColumns: ["decision_id"]
          },
          {
            foreignKeyName: "semantic_objects_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "pack_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semantic_objects_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_transformations: {
        Row: {
          attribute_id: string | null
          created_at: string
          description: string | null
          formula: string
          id: string
          inputs: Json | null
          name: string
          object_id: string | null
          pack_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          attribute_id?: string | null
          created_at?: string
          description?: string | null
          formula: string
          id?: string
          inputs?: Json | null
          name: string
          object_id?: string | null
          pack_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          attribute_id?: string | null
          created_at?: string
          description?: string | null
          formula?: string
          id?: string
          inputs?: Json | null
          name?: string
          object_id?: string | null
          pack_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semantic_transformations_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "semantic_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semantic_transformations_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "semantic_objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semantic_transformations_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_engine_runs: {
        Row: {
          facts_considered: number
          finished_at: string | null
          id: string
          mission_id: string | null
          notes: string | null
          rules_evaluated: number
          signals_emitted: number
          started_at: string
          triggered_by: string | null
        }
        Insert: {
          facts_considered?: number
          finished_at?: string | null
          id?: string
          mission_id?: string | null
          notes?: string | null
          rules_evaluated?: number
          signals_emitted?: number
          started_at?: string
          triggered_by?: string | null
        }
        Update: {
          facts_considered?: number
          finished_at?: string | null
          id?: string
          mission_id?: string | null
          notes?: string | null
          rules_evaluated?: number
          signals_emitted?: number
          started_at?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_engine_runs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_rules: {
        Row: {
          config: Json
          contributors: Json | null
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          pack_slug: string | null
          rule_key: string
          severity_default: string
          signal_type: string
          title: string
          updated_at: string
        }
        Insert: {
          config?: Json
          contributors?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          pack_slug?: string | null
          rule_key: string
          severity_default?: string
          signal_type: string
          title: string
          updated_at?: string
        }
        Update: {
          config?: Json
          contributors?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          pack_slug?: string | null
          rule_key?: string
          severity_default?: string
          signal_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          cap_score: number | null
          cause: string | null
          confidence: number
          contributors: Json
          created_at: string
          decision_contract_id: string | null
          decision_id: string | null
          entity_key: string | null
          evaluated_at: string | null
          evidence: Json
          evidence_fact_ids: string[] | null
          id: string
          impacted_decisions: Json
          mission_id: string | null
          pack_id: string | null
          payload: Json | null
          recommended_actions: Json
          rule_key: string | null
          severity: string
          signal_type: string | null
          source_system_id: string | null
          status: string
          suggested_action: string | null
          title: string
        }
        Insert: {
          cap_score?: number | null
          cause?: string | null
          confidence?: number
          contributors?: Json
          created_at?: string
          decision_contract_id?: string | null
          decision_id?: string | null
          entity_key?: string | null
          evaluated_at?: string | null
          evidence?: Json
          evidence_fact_ids?: string[] | null
          id?: string
          impacted_decisions?: Json
          mission_id?: string | null
          pack_id?: string | null
          payload?: Json | null
          recommended_actions?: Json
          rule_key?: string | null
          severity?: string
          signal_type?: string | null
          source_system_id?: string | null
          status?: string
          suggested_action?: string | null
          title: string
        }
        Update: {
          cap_score?: number | null
          cause?: string | null
          confidence?: number
          contributors?: Json
          created_at?: string
          decision_contract_id?: string | null
          decision_id?: string | null
          entity_key?: string | null
          evaluated_at?: string | null
          evidence?: Json
          evidence_fact_ids?: string[] | null
          id?: string
          impacted_decisions?: Json
          mission_id?: string | null
          pack_id?: string | null
          payload?: Json | null
          recommended_actions?: Json
          rule_key?: string | null
          severity?: string
          signal_type?: string | null
          source_system_id?: string | null
          status?: string
          suggested_action?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_decision_contract_id_fkey"
            columns: ["decision_contract_id"]
            isOneToOne: false
            referencedRelation: "decision_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decision_coverage"
            referencedColumns: ["decision_id"]
          },
          {
            foreignKeyName: "signals_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "pack_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      source_mappings: {
        Row: {
          confidence: number
          created_at: string
          criterion_id: string
          id: string
          information_asset_id: string | null
          is_source_of_truth: boolean
          notes: string | null
          precedence: number
          semantic_attribute_id: string | null
          source_system_id: string | null
          status: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          criterion_id: string
          id?: string
          information_asset_id?: string | null
          is_source_of_truth?: boolean
          notes?: string | null
          precedence?: number
          semantic_attribute_id?: string | null
          source_system_id?: string | null
          status?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          criterion_id?: string
          id?: string
          information_asset_id?: string | null
          is_source_of_truth?: boolean
          notes?: string | null
          precedence?: number
          semantic_attribute_id?: string | null
          source_system_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_mappings_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "decision_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_mappings_information_asset_id_fkey"
            columns: ["information_asset_id"]
            isOneToOne: false
            referencedRelation: "information_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_mappings_semantic_attribute_id_fkey"
            columns: ["semantic_attribute_id"]
            isOneToOne: false
            referencedRelation: "semantic_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_mappings_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      source_systems: {
        Row: {
          access_method: string | null
          base_url: string | null
          client_id: string | null
          client_secret: string | null
          connector_slug: string | null
          created_at: string
          freshness_target: string | null
          id: string
          last_discovery_at: string | null
          last_extraction_at: string | null
          mission_id: string | null
          name: string
          notes: string | null
          sector: string | null
          slug: string | null
          status: string
          system_type: string | null
          token_url: string | null
          trust_tier: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          access_method?: string | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          connector_slug?: string | null
          created_at?: string
          freshness_target?: string | null
          id?: string
          last_discovery_at?: string | null
          last_extraction_at?: string | null
          mission_id?: string | null
          name: string
          notes?: string | null
          sector?: string | null
          slug?: string | null
          status?: string
          system_type?: string | null
          token_url?: string | null
          trust_tier?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          access_method?: string | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          connector_slug?: string | null
          created_at?: string
          freshness_target?: string | null
          id?: string
          last_discovery_at?: string | null
          last_extraction_at?: string | null
          mission_id?: string | null
          name?: string
          notes?: string | null
          sector?: string | null
          slug?: string | null
          status?: string
          system_type?: string | null
          token_url?: string | null
          trust_tier?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_systems_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_decision_roles: {
        Row: {
          created_at: string | null
          decision_id: string | null
          id: string
          pack_slug: string | null
          raci: string
          stakeholder_id: string | null
        }
        Insert: {
          created_at?: string | null
          decision_id?: string | null
          id?: string
          pack_slug?: string | null
          raci?: string
          stakeholder_id?: string | null
        }
        Update: {
          created_at?: string | null
          decision_id?: string | null
          id?: string
          pack_slug?: string | null
          raci?: string
          stakeholder_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_decision_roles_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholder_decision_roles_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          confidentiality: Database["public"]["Enums"]["confidentiality_level"]
          created_at: string | null
          full_name: string
          id: string
          influence: number | null
          interest: number | null
          mission_id: string | null
          notes: string | null
          organization: string | null
          posture: string | null
          role: string | null
        }
        Insert: {
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string | null
          full_name: string
          id?: string
          influence?: number | null
          interest?: number | null
          mission_id?: string | null
          notes?: string | null
          organization?: string | null
          posture?: string | null
          role?: string | null
        }
        Update: {
          confidentiality?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string | null
          full_name?: string
          id?: string
          influence?: number | null
          interest?: number | null
          mission_id?: string | null
          notes?: string | null
          organization?: string | null
          posture?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      standardization_templates: {
        Row: {
          created_at: string
          decision_pack_target: string | null
          description: string | null
          id: string
          position: number | null
          semantic_objects: Json
          signal_rules: Json
          slug: string
          source_hints: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_pack_target?: string | null
          description?: string | null
          id?: string
          position?: number | null
          semantic_objects?: Json
          signal_rules?: Json
          slug: string
          source_hints?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_pack_target?: string | null
          description?: string | null
          id?: string
          position?: number | null
          semantic_objects?: Json
          signal_rules?: Json
          slug?: string
          source_hints?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          environment: string
          id: string
          plan: string
          price_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          plan?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          environment?: string
          id?: string
          plan?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      talent_decisions: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision_type: string
          id: string
          mission_id: string | null
          rationale: string | null
          talent_id: string | null
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_type: string
          id?: string
          mission_id?: string | null
          rationale?: string | null
          talent_id?: string | null
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_type?: string
          id?: string
          mission_id?: string | null
          rationale?: string | null
          talent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_decisions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_decisions_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_profiles: {
        Row: {
          compensation_band: string | null
          created_at: string | null
          full_name: string
          hire_date: string | null
          id: string
          level: string | null
          mission_id: string | null
          notes: string | null
          performance: string | null
          potential: string | null
          retention_risk: string | null
          role: string | null
          succession_for: string | null
          updated_at: string | null
        }
        Insert: {
          compensation_band?: string | null
          created_at?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          level?: string | null
          mission_id?: string | null
          notes?: string | null
          performance?: string | null
          potential?: string | null
          retention_risk?: string | null
          role?: string | null
          succession_for?: string | null
          updated_at?: string | null
        }
        Update: {
          compensation_band?: string | null
          created_at?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          level?: string | null
          mission_id?: string | null
          notes?: string | null
          performance?: string | null
          potential?: string | null
          retention_risk?: string | null
          role?: string | null
          succession_for?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_profiles_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_combos: {
        Row: {
          comments: Json
          created_at: string
          id: string
          leviers: Json
          local_id: string
          name: string
          owner_id: string
          preuves: Json
          session_id: string
          session_title: string
          share_token: string
          signature: Json | null
          statut: string
          timeline: Json
          updated_at: string
          verdict_initial: Json
          version: number
        }
        Insert: {
          comments?: Json
          created_at?: string
          id?: string
          leviers?: Json
          local_id: string
          name: string
          owner_id: string
          preuves?: Json
          session_id: string
          session_title?: string
          share_token?: string
          signature?: Json | null
          statut?: string
          timeline?: Json
          updated_at?: string
          verdict_initial?: Json
          version?: number
        }
        Update: {
          comments?: Json
          created_at?: string
          id?: string
          leviers?: Json
          local_id?: string
          name?: string
          owner_id?: string
          preuves?: Json
          session_id?: string
          session_title?: string
          share_token?: string
          signature?: Json | null
          statut?: string
          timeline?: Json
          updated_at?: string
          verdict_initial?: Json
          version?: number
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          admin_reply: string | null
          category: string | null
          created_at: string
          id: string
          message: string
          org_id: string | null
          path: string | null
          rating: number | null
          space: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message: string
          org_id?: string | null
          path?: string | null
          rating?: number | null
          space?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          admin_reply?: string | null
          category?: string | null
          created_at?: string
          id?: string
          message?: string
          org_id?: string | null
          path?: string | null
          rating?: number | null
          space?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pack_activations: {
        Row: {
          activated_at: string
          id: string
          pack_id: string
          user_id: string
        }
        Insert: {
          activated_at?: string
          id?: string
          pack_id: string
          user_id: string
        }
        Update: {
          activated_at?: string
          id?: string
          pack_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pack_activations_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "decision_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      v2_analyses: {
        Row: {
          contenu: Json
          created_at: string
          id: string
          owner_id: string
          thread_id: string
          titre: string
          updated_at: string
        }
        Insert: {
          contenu?: Json
          created_at?: string
          id?: string
          owner_id: string
          thread_id: string
          titre?: string
          updated_at?: string
        }
        Update: {
          contenu?: Json
          created_at?: string
          id?: string
          owner_id?: string
          thread_id?: string
          titre?: string
          updated_at?: string
        }
        Relationships: []
      }
      v2_notifications: {
        Row: {
          analyse_id: string | null
          corps: string
          created_at: string
          destinataire_id: string
          id: string
          lu: boolean
          titre: string
          type: string
        }
        Insert: {
          analyse_id?: string | null
          corps?: string
          created_at?: string
          destinataire_id: string
          id?: string
          lu?: boolean
          titre: string
          type?: string
        }
        Update: {
          analyse_id?: string | null
          corps?: string
          created_at?: string
          destinataire_id?: string
          id?: string
          lu?: boolean
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_notifications_analyse_id_fkey"
            columns: ["analyse_id"]
            isOneToOne: false
            referencedRelation: "v2_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_partages: {
        Row: {
          analyse_id: string
          created_at: string
          droit: string
          id: string
          invite_email: string
          invite_user_id: string | null
        }
        Insert: {
          analyse_id: string
          created_at?: string
          droit?: string
          id?: string
          invite_email: string
          invite_user_id?: string | null
        }
        Update: {
          analyse_id?: string
          created_at?: string
          droit?: string
          id?: string
          invite_email?: string
          invite_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_partages_analyse_id_fkey"
            columns: ["analyse_id"]
            isOneToOne: false
            referencedRelation: "v2_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_propositions: {
        Row: {
          analyse_id: string
          auteur_id: string
          auteur_nom: string
          created_at: string
          detail: string
          id: string
          label: string
          motif: string
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          analyse_id: string
          auteur_id: string
          auteur_nom?: string
          created_at?: string
          detail?: string
          id?: string
          label: string
          motif?: string
          statut?: string
          type?: string
          updated_at?: string
        }
        Update: {
          analyse_id?: string
          auteur_id?: string
          auteur_nom?: string
          created_at?: string
          detail?: string
          id?: string
          label?: string
          motif?: string
          statut?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_propositions_analyse_id_fkey"
            columns: ["analyse_id"]
            isOneToOne: false
            referencedRelation: "v2_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      attribute_source_of_truth: {
        Row: {
          attribute_name: string | null
          confidence: number | null
          object_name: string | null
          precedence: number | null
          semantic_attribute_id: string | null
          source_system_id: string | null
          source_system_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_mappings_semantic_attribute_id_fkey"
            columns: ["semantic_attribute_id"]
            isOneToOne: false
            referencedRelation: "semantic_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_mappings_source_system_id_fkey"
            columns: ["source_system_id"]
            isOneToOne: false
            referencedRelation: "source_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_coverage: {
        Row: {
          avg_confidence: number | null
          coverage: number | null
          criteria_count: number | null
          criteria_with_source: number | null
          decision_id: string | null
          name: string | null
          pack_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_decisions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_portfolio_summary: {
        Row: {
          applications_count: number | null
          avg_priority: number | null
          avg_support: number | null
          budget_eur: number | null
          capabilities_count: number | null
          effort_score: number | null
          expected_roi_eur: number | null
          id: string | null
          mission_id: string | null
          name: string | null
          packs_count: number | null
          phase: string | null
          slug: string | null
          status: string | null
          total_decision_lift: number | null
          value_score: number | null
        }
        Insert: {
          applications_count?: never
          avg_priority?: never
          avg_support?: never
          budget_eur?: number | null
          capabilities_count?: never
          effort_score?: number | null
          expected_roi_eur?: number | null
          id?: string | null
          mission_id?: string | null
          name?: string | null
          packs_count?: never
          phase?: string | null
          slug?: string | null
          status?: string | null
          total_decision_lift?: never
          value_score?: number | null
        }
        Update: {
          applications_count?: never
          avg_priority?: never
          avg_support?: never
          budget_eur?: number | null
          capabilities_count?: never
          effort_score?: number | null
          expected_roi_eur?: number | null
          id?: string | null
          mission_id?: string | null
          name?: string | null
          packs_count?: never
          phase?: string | null
          slug?: string | null
          status?: string | null
          total_decision_lift?: never
          value_score?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_confidential: {
        Args: {
          _level: Database["public"]["Enums"]["confidentiality_level"]
          _uid: string
        }
        Returns: boolean
      }
      has_platform_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_mission_member: { Args: { _mission_id: string }; Returns: boolean }
      is_org_admin: { Args: { _org: string }; Returns: boolean }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      v2_est_invite: {
        Args: { _analyse: string; _droit?: string }
        Returns: boolean
      }
      v2_est_proprietaire: { Args: { _analyse: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "decideur"
        | "rh"
        | "comex"
        | "operationnel"
        | "manager"
        | "direction"
        | "admin_metier"
        | "architecte"
      confidentiality_level: "public" | "restricted" | "comex" | "rh_only"
      ea_approval_action: "soumis" | "approuve" | "rejete"
      ea_criticality: "vitale" | "importante" | "secondaire"
      ea_lifecycle: "propose" | "valide" | "obsolete"
      ea_object_kind:
        | "objet_metier"
        | "application"
        | "capacite"
        | "domaine_donnees"
        | "indicateur"
      ea_value_verdict: "en_attente" | "atteint" | "partiel" | "non_atteint"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "decideur",
        "rh",
        "comex",
        "operationnel",
        "manager",
        "direction",
        "admin_metier",
        "architecte",
      ],
      confidentiality_level: ["public", "restricted", "comex", "rh_only"],
      ea_approval_action: ["soumis", "approuve", "rejete"],
      ea_criticality: ["vitale", "importante", "secondaire"],
      ea_lifecycle: ["propose", "valide", "obsolete"],
      ea_object_kind: [
        "objet_metier",
        "application",
        "capacite",
        "domaine_donnees",
        "indicateur",
      ],
      ea_value_verdict: ["en_attente", "atteint", "partiel", "non_atteint"],
    },
  },
} as const
