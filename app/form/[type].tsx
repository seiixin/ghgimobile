import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Network from 'expo-network';
import { useForm, Controller } from 'react-hook-form';
import api from '@/lib/api';
import { saveDraft } from '@/lib/db';
import {
  getCachedBarangays, cacheBarangays,
  getLocalEFs, setMemEFs, getCachedEFs, cacheEFs,
  getCachedYears, cacheYears,
  type LocalBarangay, type LocalEF, type CachedYear,
} from '@/lib/localData';

// ─── Field definitions ────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'select' | 'textarea';

interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** If true, options come from local EF JSON for this form type */
  isEFPicker?: boolean;
  /** numeric keyboard */
  numeric?: boolean;
}

interface FormConfig {
  label: string;
  fields: FieldDef[];
}

// ─── Per-form configs (mirrors web JSX forms exactly) ────────────────────────

const FORM_CONFIGS: Record<string, FormConfig> = {
  mobile_combustion: {
    label: 'Mobile Combustion',
    fields: [
      {
        name: 'method', label: 'Calculation Method', type: 'select', required: true,
        options: [
          { value: 'fuel_based',      label: 'Fuel-Based'      },
          { value: 'distance_based',  label: 'Distance-Based'  },
        ],
      },
      // fuel_based fields — shown conditionally in render
      {
        name: 'emission_factor_id', label: 'Fuel Type', type: 'select',
        required: true, isEFPicker: true,
      },
      {
        name: 'annual_fuel_litres', label: 'Annual Fuel Consumption (L)',
        type: 'number', required: true, placeholder: 'e.g. 115527', numeric: true,
      },
      // distance_based fields — shown conditionally in render
      {
        name: 'emission_factor_id_dist', label: 'Vehicle Type', type: 'select',
        required: true, isEFPicker: true,
      },
      {
        name: 'annual_distance_km', label: 'Annual Distance (km)',
        type: 'number', required: true, placeholder: 'e.g. 50000', numeric: true,
      },
    ],
  },

  stationary_combustion: {
    label: 'Stationary Combustion',
    fields: [
      {
        name: 'building_type', label: 'Building Type', type: 'select', required: true,
        options: [
          { value: 'residential', label: 'Residential' },
          { value: 'commercial',  label: 'Commercial'  },
        ],
      },
      { name: 'emission_factor_id', label: 'Fuel Type',               type: 'select', required: true, isEFPicker: true },
      { name: 'annual_consumption',  label: 'Annual Fuel Consumption', type: 'number', required: true, placeholder: 'e.g. 5000', numeric: true },
      { name: 'annual_fee_kg',       label: 'Annual Fee (kg)',         type: 'number', required: true, placeholder: 'e.g. 1200', numeric: true },
      { name: 'facility_description', label: 'Facility Description',  type: 'text',   required: false, placeholder: 'e.g. City Hall boiler room' },
    ],
  },

  electricity_consumption: {
    label: 'Electricity Consumption',
    fields: [
      {
        name: 'site_type', label: 'Site Type', type: 'select', required: true,
        options: [
          { value: 'residential', label: 'Residential'       },
          { value: 'commercial',  label: 'Commercial'        },
          { value: 'other',       label: 'All Other Sources' },
        ],
      },
      { name: 'annual_kwh',         label: 'Annual Electricity Consumption (kWh)', type: 'number', required: true, placeholder: 'e.g. 120000', numeric: true },
      { name: 'emission_factor_id', label: 'Grid Emission Factor',                 type: 'select', required: true, isEFPicker: true },
    ],
  },

  livestock: {
    label: 'Livestock',
    fields: [
      { name: 'emission_factor_id', label: 'Livestock Type',                  type: 'select', required: true, isEFPicker: true },
      { name: 'head_count',         label: 'Head Count (number of animals)',  type: 'number', required: true, placeholder: 'e.g. 250', numeric: true },
    ],
  },

  crops: {
    label: 'Crops',
    fields: [
      { name: 'emission_factor_id', label: 'Crop Type',              type: 'select', required: true, isEFPicker: true },
      { name: 'area_hectares',      label: 'Cultivated Area (ha)',   type: 'number', required: true, placeholder: 'e.g. 12.5', numeric: true },
    ],
  },

  solid_waste: {
    label: 'Solid Waste',
    fields: [
      {
        name: 'disposal_method', label: 'Disposal Method', type: 'select', required: true,
        options: [
          { value: 'ipcc_fod',               label: 'IPCC FOD Method'              },
          { value: 'iclei_landfill_inside',  label: 'ICLEI Landfill – Inside LGU'  },
          { value: 'iclei_other_treatment',  label: 'ICLEI Other Treatment'        },
          { value: 'open_burning',           label: 'Open Burning (ICLEI)'         },
          { value: 'iclei_landfill_outside', label: 'ICLEI Landfill – Outside LGU' },
        ],
      },
      { name: 'emission_factor_id',    label: 'Waste System / Landfill Type', type: 'select', required: true, isEFPicker: true },
      { name: 'waste_quantity_tonnes', label: 'Waste Quantity (tonnes)', type: 'number', required: true, placeholder: 'e.g. 500', numeric: true },
    ],
  },

  wastewater: {
    label: 'Wastewater',
    fields: [
      {
        name: 'treatment_location', label: 'Treatment Location', type: 'select', required: true,
        options: [
          { value: 'inside_lgu',  label: 'Inside LGU (Scope 1)'  },
          { value: 'outside_lgu', label: 'Outside LGU (Scope 3)' },
        ],
      },
      { name: 'volume_m3',          label: 'Wastewater Volume (m³)', type: 'number', required: true, placeholder: 'e.g. 10000', numeric: true },
      { name: 'emission_factor_id', label: 'Treatment Factor',       type: 'select', required: true, isEFPicker: true },
    ],
  },

  biological_treatment: {
    label: 'Biological Treatment',
    fields: [
      {
        name: 'treatment_type', label: 'Treatment Type', type: 'select', required: true,
        options: [
          { value: 'composting',          label: 'Composting'          },
          { value: 'anaerobic_digestion', label: 'Anaerobic Digestion' },
        ],
      },
      { name: 'quantity_tonnes', label: 'Quantity (tonnes)', type: 'number', required: true, placeholder: 'e.g. 200', numeric: true },
    ],
  },

  industrial_processes: {
    label: 'Industrial Processes',
    fields: [
      { name: 'emission_factor_id', label: 'Process Type',      type: 'select', required: true, isEFPicker: true },
      { name: 'activity_quantity',  label: 'Activity Quantity', type: 'number', required: true, placeholder: 'e.g. 1000', numeric: true },
    ],
  },

  forestry: {
    label: 'Forestry / Land Use',
    fields: [
      { name: 'emission_factor_id', label: 'Land-Use Type',   type: 'select', required: true, isEFPicker: true },
      { name: 'area_hectares',      label: 'Area (hectares)', type: 'number', required: true, placeholder: 'e.g. 50', numeric: true },
    ],
  },

  forestry_removal: {
    label: 'Forestry Removal (GHG Removal from Sink)',
    fields: [
      {
        name: 'removal_type', label: 'Removal Type', type: 'select', required: true,
        options: [
          { value: 'Forest',       label: 'Forest'       },
          { value: 'Cropland',     label: 'Cropland'     },
          { value: 'Grassland',    label: 'Grassland'    },
          { value: 'Wetlands',     label: 'Wetlands'     },
          { value: 'Settlements',  label: 'Settlements'  },
          { value: 'Other Land',   label: 'Other Land'   },
        ],
      },
      {
        name: 'removal_source', label: 'Removal Source', type: 'select', required: true,
        options: [
          { value: 'Biomass',                   label: 'Biomass'                   },
          { value: 'Soil',                      label: 'Soil'                      },
          { value: 'Dead Wood',                 label: 'Dead Wood'                 },
          { value: 'Litter',                    label: 'Litter'                    },
          { value: 'Harvested Wood Products',   label: 'Harvested Wood Products'   },
        ],
      },
      { name: 'emission_factor_id', label: 'Removal Factor', type: 'select', required: true, isEFPicker: true },
      { name: 'area_hectares',      label: 'Area (hectares)', type: 'number', required: true, placeholder: 'e.g. 50', numeric: true },
    ],
  },

  air_travel: {
    label: 'Air Travel',
    fields: [
      { name: 'emission_factor_id', label: 'Flight Distance Category', type: 'select', required: true, isEFPicker: true },
      { name: 'passenger_km',       label: 'Passenger-km',             type: 'number', required: true, placeholder: 'e.g. 25000', numeric: true },
    ],
  },

  business_travel: {
    label: 'Business Travel',
    fields: [
      { name: 'emission_factor_id', label: 'Transport Mode', type: 'select', required: true, isEFPicker: true },
      { name: 'distance_km',        label: 'Distance (km)',  type: 'number', required: true, placeholder: 'e.g. 3000', numeric: true },
    ],
  },
};

// ─── SimpleSelect — scrollable dropdown ──────────────────────────────────────

interface SelectOption { id: string | number; label: string }

interface SelectProps {
  label: string;
  value: string;
  onSelect: (v: string) => void;
  options: SelectOption[];
}

function SimpleSelect({ label, value, onSelect, options }: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.id) === value);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.selectBtn} onPress={() => setOpen(!open)}>
        <Text style={{ color: selected ? '#111827' : '#9ca3af', fontSize: 14, flex: 1 }}>
          {selected?.label ?? `Select ${label}...`}
        </Text>
        <Text style={{ color: '#9ca3af' }}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <ScrollView style={styles.dropdown} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {options.map((o) => (
            <TouchableOpacity
              key={String(o.id)}
              style={styles.dropdownItem}
              onPress={() => { onSelect(String(o.id)); setOpen(false); }}
            >
              <Text style={{ fontSize: 13, color: '#111827' }}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── FieldRenderer — renders a single FieldDef ───────────────────────────────

interface FieldRendererProps {
  field: FieldDef;
  control: any;
  errors: any;
  efs: LocalEF[];
}

function FieldRenderer({ field, control, errors, efs }: FieldRendererProps) {
  // EF picker: use local EF list; if empty, skip (not required)
  if (field.isEFPicker) {
    if (efs.length === 0) {
      return (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', marginTop: 4 }}>
            No emission factors available — field not required.
          </Text>
        </View>
      );
    }
    return (
      <>
        <Controller
          control={control}
          name={field.name}
          rules={field.required ? { required: `${field.label} is required` } : {}}
          render={({ field: { value, onChange } }) => (
            <SimpleSelect
              label={field.label}
              value={value}
              onSelect={onChange}
              options={efs.map((e) => ({ id: e.id, label: e.label }))}
            />
          )}
        />
        {errors[field.name] && <Text style={styles.error}>{errors[field.name].message}</Text>}
      </>
    );
  }

  // Static select
  if (field.type === 'select' && field.options) {
    return (
      <>
        <Controller
          control={control}
          name={field.name}
          rules={field.required ? { required: `${field.label} is required` } : {}}
          render={({ field: { value, onChange } }) => (
            <SimpleSelect
              label={field.label}
              value={value}
              onSelect={onChange}
              options={field.options!.map((o) => ({ id: o.value, label: o.label }))}
            />
          )}
        />
        {errors[field.name] && <Text style={styles.error}>{errors[field.name].message}</Text>}
      </>
    );
  }

  // Text / number / textarea
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <Controller
        control={control}
        name={field.name}
        rules={field.required ? { required: `${field.label} is required` } : {}}
        render={({ field: { value, onChange } }) => (
          <TextInput
            style={[styles.input, field.type === 'textarea' && { height: 80 }]}
            value={value}
            onChangeText={onChange}
            keyboardType={field.numeric ? 'numeric' : 'default'}
            multiline={field.type === 'textarea'}
            placeholder={field.placeholder ?? ''}
            placeholderTextColor="#9ca3af"
          />
        )}
      />
      {errors[field.name] && <Text style={styles.error}>{errors[field.name].message}</Text>}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FormScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router   = useRouter();
  const config   = type ? FORM_CONFIGS[type] : undefined;

  // mobile_combustion method toggle
  const [mobilMethod, setMobilMethod] = useState<'fuel_based' | 'distance_based'>('fuel_based');

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      barangay_id:          '',
      inventory_year_id:    '',
      data_source:          '',
      notes:                '',
      latitude:             '',
      longitude:            '',
      // mobile_combustion
      method:               'fuel_based',
      emission_factor_id:   '',
      annual_fuel_litres:   '',
      emission_factor_id_dist: '',
      annual_distance_km:   '',
      // stationary_combustion
      building_type:        '',
      annual_consumption:   '',
      annual_fee_kg:        '',
      facility_description: '',
      // electricity_consumption
      site_type:            '',
      annual_kwh:           '',
      // livestock
      head_count:           '',
      // crops / forestry / forestry_removal
      area_hectares:        '',
      // solid_waste
      disposal_method:      '',
      waste_quantity_tonnes:'',
      // wastewater
      treatment_location:   '',
      volume_m3:            '',
      // biological_treatment
      treatment_type:       '',
      quantity_tonnes:      '',
      // industrial_processes
      activity_quantity:    '',
      // forestry_removal
      removal_type:         '',
      removal_source:       '',
      // air_travel
      passenger_km:         '',
      // business_travel
      distance_km:          '',
    },
  });

  const [submitting, setSubmitting] = useState(false);
  const [years, setYears]           = useState<CachedYear[]>([]);
  const [barangays, setBarangays]   = useState<LocalBarangay[]>([]);
  const [co2ePreview, setCo2ePreview] = useState<number | null>(null);

  // EFs loaded from API cache (real DB ids) — not local JSON index
  const [efs, setEfs] = useState<LocalEF[]>([]);

  // Barangays: try API first, cache in SQLite, fall back offline
  useEffect(() => {
    async function loadBarangays() {
      try {
        const net = await Network.getNetworkStateAsync();
        if (net.isConnected && net.isInternetReachable) {
          const { data } = await api.get('/barangays');
          await cacheBarangays(data);
          setBarangays(data);
        } else {
          setBarangays(await getCachedBarangays());
        }
      } catch {
        setBarangays(await getCachedBarangays());
      }
    }
    loadBarangays();
  }, []);

  // Years: try API first, cache in SQLite, fall back offline
  useEffect(() => {
    async function loadYears() {
      try {
        const net = await Network.getNetworkStateAsync();
        if (net.isConnected && net.isInternetReachable) {
          const { data } = await api.get('/inventory-years');
          await cacheYears(data);
          setYears(data);
        } else {
          setYears(await getCachedYears());
        }
      } catch {
        setYears(await getCachedYears());
      }
    }
    loadYears();
  }, []);

  // EFs: fetch from API filtered by gas_type=CO2, cache with real DB ids
  useEffect(() => {
    if (!type) return;
    async function loadEFs() {
      try {
        const net = await Network.getNetworkStateAsync();
        if (net.isConnected && net.isInternetReachable) {
          const { data } = await api.get('/emission-factors', { params: { gas_type: 'CO2' } });
          await cacheEFs(data);
        }
        const cached = await getCachedEFs(type);
        setEfs(cached);
        setMemEFs(type, cached);
      } catch {
        const cached = await getCachedEFs(type);
        setEfs(cached);
        setMemEFs(type, cached);
      }
    }
    loadEFs();
  }, [type]);

  // CO2e live preview — activity field × EF value / 1000
  const watchedValues = watch();
  useEffect(() => {
    if (!type || !config) { setCo2ePreview(null); return; }

    // Determine which activity field is active
    const ACT_FIELD: Record<string, string> = {
      stationary_combustion:   'annual_consumption',
      electricity_consumption: 'annual_kwh',
      livestock:               'head_count',
      crops:                   'area_hectares',
      solid_waste:             'waste_quantity_tonnes',
      wastewater:              'volume_m3',
      biological_treatment:    'quantity_tonnes',
      industrial_processes:    'activity_quantity',
      forestry:                'area_hectares',
      forestry_removal:        'area_hectares',
      air_travel:              'passenger_km',
      business_travel:         'distance_km',
    };

    let activityVal: number;
    if (type === 'mobile_combustion') {
      activityVal = parseFloat(mobilMethod === 'fuel_based'
        ? watchedValues.annual_fuel_litres
        : watchedValues.annual_distance_km) || 0;
    } else {
      activityVal = parseFloat((watchedValues as any)[ACT_FIELD[type] ?? ''] ?? '') || 0;
    }

    const efFieldName = (type === 'mobile_combustion' && mobilMethod === 'distance_based')
      ? 'emission_factor_id_dist'
      : 'emission_factor_id';
    const efId = watchedValues[efFieldName];
    const ef   = efs.find((e) => String(e.id) === efId);

    if (ef && activityVal > 0) {
      setCo2ePreview((activityVal * ef.value) / 1000);
    } else {
      setCo2ePreview(null);
    }
  }, [JSON.stringify(watchedValues), mobilMethod, efs, type]);

  // GPS
  async function captureGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied', 'Location permission is required.'); return; }
    const loc = await Location.getCurrentPositionAsync({});
    setValue('latitude',  String(loc.coords.latitude));
    setValue('longitude', String(loc.coords.longitude));
    Alert.alert('Location captured', `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
  }

  async function onSubmit(values: any, status: 'Draft' | 'Submitted' = 'Submitted') {
    if (!config || !type) return;
    setSubmitting(true);

    const selectedBarangay = barangays.find((b) => String(b.id) === values.barangay_id);
    const selectedYear     = years.find((y) => String(y.id) === values.inventory_year_id);

    // Resolve EF — mobile_combustion uses two separate EF fields per method
    let efId = values.emission_factor_id;
    if (type === 'mobile_combustion' && mobilMethod === 'distance_based') {
      efId = values.emission_factor_id_dist;
    }
    const selectedEF = efs.find((e) => String(e.id) === efId);

    const payload: Record<string, any> = {
      form_type:               type,
      barangay_id:             selectedBarangay?.id,
      inventory_year_id:       selectedYear?.id,
      emission_factor_label:   selectedEF?.label,
      emission_factor_value:   selectedEF?.value,
      emission_factor_unit:    selectedEF?.unit,
      data_source:             values.data_source || undefined,
      notes:                   values.notes       || undefined,
      latitude:                values.latitude    ? parseFloat(values.latitude)  : undefined,
      longitude:               values.longitude   ? parseFloat(values.longitude) : undefined,
      status,
    };

    // Per-form payload fields — exact field names matching backend
    switch (type) {
      case 'mobile_combustion':
        payload.method = mobilMethod;
        if (mobilMethod === 'fuel_based') {
          payload.emission_factor_id  = efId;
          payload.annual_fuel_litres  = parseFloat(values.annual_fuel_litres);
        } else {
          payload.emission_factor_id  = efId;
          payload.annual_distance_km  = parseFloat(values.annual_distance_km);
        }
        break;
      case 'stationary_combustion':
        payload.building_type        = values.building_type;
        payload.emission_factor_id   = efId;
        payload.annual_consumption   = parseFloat(values.annual_consumption);
        payload.annual_fee_kg        = parseFloat(values.annual_fee_kg);
        payload.facility_description = values.facility_description || undefined;
        break;
      case 'electricity_consumption':
        payload.site_type          = values.site_type;
        payload.annual_kwh         = parseFloat(values.annual_kwh);
        payload.emission_factor_id = efId;
        break;
      case 'livestock':
        payload.emission_factor_id = efId;
        payload.head_count         = parseInt(values.head_count, 10);
        break;
      case 'crops':
        payload.emission_factor_id = efId;
        payload.area_hectares      = parseFloat(values.area_hectares);
        break;
      case 'solid_waste':
        payload.disposal_method      = values.disposal_method;
        payload.emission_factor_id   = efId;
        payload.waste_quantity_tonnes = parseFloat(values.waste_quantity_tonnes);
        break;
      case 'wastewater':
        payload.treatment_location = values.treatment_location;
        payload.volume_m3          = parseFloat(values.volume_m3);
        payload.emission_factor_id = efId;
        break;
      case 'biological_treatment':
        payload.treatment_type  = values.treatment_type;
        payload.quantity_tonnes = parseFloat(values.quantity_tonnes);
        // No emission_factor_id — backend resolves EF from treatment_type
        break;
      case 'industrial_processes':
        payload.emission_factor_id = efId;
        payload.activity_quantity  = parseFloat(values.activity_quantity);
        break;
      case 'forestry':
        payload.emission_factor_id = efId;
        payload.area_hectares      = parseFloat(values.area_hectares);
        break;
      case 'forestry_removal':
        payload.removal_type       = values.removal_type;
        payload.removal_source     = values.removal_source;
        payload.emission_factor_id = efId;
        payload.area_hectares      = parseFloat(values.area_hectares);
        break;
      case 'air_travel':
        payload.emission_factor_id = efId;
        payload.passenger_km       = parseFloat(values.passenger_km);
        break;
      case 'business_travel':
        payload.emission_factor_id = efId;
        payload.distance_km        = parseFloat(values.distance_km);
        break;
    }

    const net      = await Network.getNetworkStateAsync();
    const isOnline = net.isConnected && net.isInternetReachable;

    if (isOnline) {
      try {
        // Both Draft and Submitted go to the server — status is in the payload
        await api.post('/submissions', payload);
        if (status === 'Draft') {
          Alert.alert('Draft Saved', 'Your draft has been saved. You can submit it later from the Drafts tab.');
        } else {
          Alert.alert('Submitted', 'Your data has been submitted successfully.');
        }
        router.back();
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? 'Submission failed.';
        Alert.alert('Error', msg);
      }
    } else {
      // Offline — always save as 'offline' source so Sync tab picks it up
      await saveDraft({
        id:         `${type}_${Date.now()}`,
        form_type:  type,
        form_data:  { ...payload, status: 'Draft' },
        created_at: new Date().toISOString(),
        source:     'offline',
      });
      Alert.alert('Saved Offline', 'No internet. Saved locally and will sync when online.');
      router.back();
    }

    setSubmitting(false);
  }

  if (!config) {
    return <View style={styles.center}><Text>Unknown form type: {type}</Text></View>;
  }

  // Determine which fields to render for mobile_combustion based on method
  const fieldsToRender = config.fields.filter((f) => {
    if (type !== 'mobile_combustion') return true;
    if (f.name === 'method') return true;
    if (mobilMethod === 'fuel_based')     return f.name !== 'emission_factor_id_dist' && f.name !== 'annual_distance_km';
    if (mobilMethod === 'distance_based') return f.name !== 'emission_factor_id'      && f.name !== 'annual_fuel_litres';
    return true;
  });

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{config.label}</Text>
      </View>

      {/* Barangay */}
      <Controller
        control={control}
        name="barangay_id"
        rules={{ required: 'Barangay is required' }}
        render={({ field: { value, onChange } }) => (
          <SimpleSelect label="Barangay" value={value} onSelect={onChange}
            options={barangays.length
              ? barangays.map((b) => ({ id: b.id, label: b.name }))
              : [{ id: 'loading', label: 'Loading barangays...' }]
            } />
        )}
      />
      {errors.barangay_id && <Text style={styles.error}>{errors.barangay_id.message as string}</Text>}

      {/* Inventory Year */}
      <Controller
        control={control}
        name="inventory_year_id"
        rules={{ required: 'Inventory year is required' }}
        render={({ field: { value, onChange } }) => (
          <SimpleSelect label="Inventory Year" value={value} onSelect={onChange}
            options={years.length
              ? years.map((y) => ({ id: y.id, label: String(y.year) }))
              : [{ id: 'loading', label: 'Loading years...' }]
            } />
        )}
      />
      {errors.inventory_year_id && <Text style={styles.error}>{errors.inventory_year_id.message as string}</Text>}

      {/* Per-form fields */}
      {fieldsToRender.map((field) => {
        // mobile_combustion method toggle — render as radio-style buttons
        if (type === 'mobile_combustion' && field.name === 'method') {
          return (
            <View key="method" style={styles.field}>
              <Text style={styles.fieldLabel}>Calculation Method</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                {[
                  { value: 'fuel_based',     label: 'Fuel-Based'     },
                  { value: 'distance_based', label: 'Distance-Based' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.radioBtn, mobilMethod === opt.value && styles.radioBtnActive]}
                    onPress={() => {
                      setMobilMethod(opt.value as 'fuel_based' | 'distance_based');
                      setValue('method', opt.value);
                    }}
                  >
                    <Text style={[styles.radioBtnText, mobilMethod === opt.value && styles.radioBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        }

        // EF picker for distance_based uses emission_factor_id_dist field name but same EF list
        const efList = (type === 'mobile_combustion' && field.name === 'emission_factor_id_dist')
          ? efs
          : efs;

        return (
          <FieldRenderer
            key={field.name}
            field={field}
            control={control}
            errors={errors}
            efs={efList}
          />
        );
      })}

      {/* CO2e Preview */}
      {co2ePreview !== null && (
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Estimated CO₂e</Text>
          <Text style={styles.previewValue}>{co2ePreview.toFixed(4)} tonnes CO₂e</Text>
        </View>
      )}

      {/* Data source */}
      <Controller
        control={control}
        name="data_source"
        rules={{ required: 'Data source is required' }}
        render={({ field: { value, onChange } }) => (
          <SimpleSelect
            label="Data Source"
            value={value}
            onSelect={onChange}
            options={[
              { id: 'survey',              label: 'Survey'                    },
              { id: 'official_records',    label: 'Official Records'          },
              { id: 'utility_bills',       label: 'Utility Bills'             },
              { id: 'government_database', label: 'Government Database'       },
              { id: 'field_measurement',   label: 'Field Measurement'         },
              { id: 'estimation',          label: 'Estimation'                },
              { id: 'third_party_report',  label: 'Third-Party Report'        },
              { id: 'other',               label: 'Other'                     },
            ]}
          />
        )}
      />
      {errors.data_source && <Text style={styles.error}>{errors.data_source.message as string}</Text>}

      {/* Notes */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange } }) => (
            <TextInput style={[styles.input, { height: 80 }]} value={value} onChangeText={onChange}
              multiline placeholder="Additional notes..." placeholderTextColor="#9ca3af" />
          )}
        />
      </View>

      {/* GPS */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Location (GPS)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} value={watch('latitude')}  placeholder="Latitude"  placeholderTextColor="#9ca3af" editable={false} />
          <TextInput style={[styles.input, { flex: 1 }]} value={watch('longitude')} placeholder="Longitude" placeholderTextColor="#9ca3af" editable={false} />
        </View>
        <TouchableOpacity style={styles.gpsBtn} onPress={captureGPS}>
          <Text style={styles.gpsBtnText}>📍 Capture GPS</Text>
        </TouchableOpacity>
      </View>

      {/* Draft + Submit buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.draftBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit((v) => onSubmit(v, 'Draft'))}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#16a34a" /> : <Text style={styles.draftText}>Save Draft</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit((v) => onSubmit(v, 'Submitted'))}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit</Text>}
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f9fafb' },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formHeader:       { backgroundColor: '#15803d', padding: 20, paddingTop: 24 },
  formTitle:        { fontSize: 20, fontWeight: '700', color: '#fff' },
  field:            { marginHorizontal: 16, marginTop: 16 },
  fieldLabel:       { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:            { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 14, color: '#111827' },
  error:            { color: '#ef4444', fontSize: 12, marginTop: 4, marginHorizontal: 16 },
  selectBtn:        { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdown:         { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, marginTop: 2, maxHeight: 200 },
  dropdownItem:     { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  gpsBtn:           { marginTop: 8, backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, alignItems: 'center' },
  gpsBtnText:       { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  submitBtn:        { flex: 1, backgroundColor: '#16a34a', borderRadius: 10, padding: 16, alignItems: 'center' },
  submitText:       { color: '#fff', fontWeight: '700', fontSize: 16 },
  draftBtn:         { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#16a34a', borderRadius: 10, padding: 16, alignItems: 'center' },
  draftText:        { color: '#16a34a', fontWeight: '700', fontSize: 16 },
  buttonRow:        { flexDirection: 'row', marginHorizontal: 16, marginTop: 24, gap: 10 },
  radioBtn:         { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: '#fff' },
  radioBtnActive:   { borderColor: '#16a34a', backgroundColor: '#dcfce7' },
  radioBtnText:     { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  radioBtnTextActive: { color: '#15803d', fontWeight: '700' },
  previewCard:      { marginHorizontal: 16, marginTop: 16, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 10, padding: 14 },
  previewLabel:     { fontSize: 12, color: '#15803d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewValue:     { fontSize: 20, fontWeight: '700', color: '#15803d', marginTop: 4 },
});
