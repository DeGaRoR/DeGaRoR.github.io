import { useState, useRef, useCallback, useEffect } from "react";

const T = 48;
const snap = v => Math.round(v);
const C = { body:'#2a3040', stroke:'#4a5464', vp:'#0f0820', vpRim:'#134e4a', bolt:'#1f2937', bs:'#6b7280', bg:'#0d1117' };

const S = {
  pump: () => <><rect x={19} y={19} width={58} height={58} rx={10} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><line x1={19} y1={47} x2={77} y2={47} stroke={C.stroke} strokeWidth={1} opacity={.5}/><circle cx={48} cy={39} r={14} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/><rect x={35} y={5} width={26} height={16} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2}/></>,
  source: () => <><circle cx={48} cy={48} r={28} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={48} r={22} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/></>,
  source_atm: () => <><path d="M4,10 Q2,48 4,86 L56,66 Q62,48 56,30 Z" fill={C.body} stroke={C.stroke} strokeWidth={2.5} strokeLinejoin="round"/><path d="M12,18 Q10,48 12,78 L48,60 Q52,48 48,36 Z" fill={C.vp} opacity={.7}/><line x1={4} y1={10} x2={4} y2={86} stroke="#6ee7b7" strokeWidth={2} strokeDasharray="3 3" opacity={.4}/></>,
  sink: () => <><rect x={32} y={14} width={32} height={68} rx={4} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={34} y={18} width={28} height={36} rx={3} fill="#0f172a" opacity={.85}/></>,
  closed_loop_source: () => <><circle cx={48} cy={48} r={28} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={48} r={22} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/></>,
  atmosphere: () => <><rect x={14} y={16} width={68} height={64} rx={12} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/></>,
  reservoir: () => <><rect x={34} y={6} width={12} height={8} rx={3} fill={C.body} stroke={C.stroke} strokeWidth={1.5}/><rect x={28} y={32} width={24} height={10} rx={3} fill={C.body} stroke={C.stroke} strokeWidth={2}/><rect x={34} y={36} width={12} height={36} rx={2} fill={C.body} stroke={C.stroke} strokeWidth={2}/><rect x={32} y={16} width={32} height={48} rx={3} fill={C.vp} stroke={C.vpRim} strokeWidth={1} opacity={.4}/></>,
  restriction: () => <><rect x={38} y={16} width={20} height={64} rx={3} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><ellipse cx={48} cy={45} rx={5} ry={12} fill="#0b0e14" stroke={C.stroke} strokeWidth={1.5}/></>,
  bend: () => <><path d="M48,0 L48,48 L96,48" fill="none" stroke={C.stroke} strokeWidth={10} strokeLinecap="butt" strokeLinejoin="round"/><path d="M48,0 L48,48 L96,48" fill="none" stroke={C.body} strokeWidth={6} strokeLinecap="butt" strokeLinejoin="round"/></>,
  hydrovent: () => <><rect x={4} y={64} width={88} height={24} rx={3} fill="#1f2937" stroke="#374151" strokeWidth={2}/><rect x={30} y={40} width={20} height={16} rx={3} fill={C.body} stroke={C.stroke} strokeWidth={2}/><rect x={30} y={58} width={20} height={8} rx={2} fill={C.body} stroke={C.stroke} strokeWidth={2}/></>,
  grid_supply: () => <><rect x={8} y={17} width={80} height={62} rx={12} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={48} r={18} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/></>,
  solar_panel: () => <><rect x={8} y={14} width={80} height={68} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><line x1={48} y1={18} x2={48} y2={78} stroke={C.stroke} strokeWidth={1} opacity={.4}/><line x1={12} y1={48} x2={84} y2={48} stroke={C.stroke} strokeWidth={1} opacity={.4}/></>,
  wind_turbine: () => <><rect x={42} y={48} width={12} height={36} rx={2} fill={C.body} stroke={C.stroke} strokeWidth={2}/><rect x={28} y={30} width={40} height={22} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={32} y={80} width={32} height={6} rx={2} fill={C.body} stroke={C.stroke} strokeWidth={1.5}/><circle cx={48} cy={30} r={4} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/></>,
  battery: () => <><rect x={22} y={18} width={52} height={60} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={36} y={10} width={24} height={10} rx={4} fill="#4b5563" stroke="#374151" strokeWidth={2}/><rect x={30} y={28} width={36} height={42} rx={3} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5} opacity={.6}/></>,
  sink_electrical: () => <><rect x={10} y={17} width={76} height={62} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={18} y={25} width={60} height={46} rx={4} fill="#1a0500" stroke={C.stroke} strokeWidth={1.5}/></>,
  power_hub: () => <><rect x={12} y={10} width={72} height={124} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={20} y={18} width={56} height={108} rx={4} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5} opacity={.5}/></>,
  power_dispatcher_5: () => <><rect x={12} y={10} width={72} height={124} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={20} y={18} width={56} height={108} rx={4} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5} opacity={.5}/></>,
  compressor: () => <><rect x={18} y={24} width={60} height={48} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={28} y={32} width={36} height={32} rx={4} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/><rect x={35} y={72} width={26} height={16} rx={5} fill={C.body} stroke={C.stroke} strokeWidth={2}/></>,
  fan: () => <><rect x={16} y={18} width={64} height={60} rx={14} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={48} r={18} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/><rect x={36} y={6} width={24} height={14} rx={4} fill={C.body} stroke={C.stroke} strokeWidth={1.5}/></>,
  compressor_diaphragm: () => <><rect x={14} y={8} width={68} height={64} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={22} y={16} width={52} height={48} rx={5} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/></>,
  gas_turbine: () => <><rect x={14} y={22} width={68} height={52} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={24} y={30} width={48} height={36} rx={4} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/><rect x={28} y={4} width={40} height={20} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2}/><rect x={28} y={72} width={40} height={20} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2}/></>,
  electric_heater: () => <><rect x={10} y={26} width={76} height={44} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={22} y={34} width={52} height={28} rx={4} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/><rect x={35} y={70} width={26} height={14} rx={5} fill={C.body} stroke={C.stroke} strokeWidth={2}/></>,
  air_cooler: () => <><rect x={12} y={38} width={72} height={38} rx={2} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={16} y={42} width={64} height={30} rx={4} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/><circle cx={48} cy={24} r={22} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={24} r={16} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/></>,
  hex: () => <><ellipse cx={48} cy={48} rx={40} ry={30} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><ellipse cx={48} cy={48} rx={34} ry={24} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/></>,
  valve: () => { const cx=48,cy=48; return <><line x1={cx} y1={20} x2={cx} y2={cy} stroke="#6b7280" strokeWidth={3}/><circle cx={cx} cy={20} r={8} fill="none" stroke="#4b5563" strokeWidth={2}/><circle cx={cx} cy={20} r={3} fill="#1f2937" stroke="#4b5563" strokeWidth={1.5}/><rect x={cx-5} y={30} width={10} height={4} rx={1.5} fill="#374151" stroke="#4b5563" strokeWidth={1}/><polygon points="24,31 48,48 24,65" fill={C.body} stroke={C.stroke} strokeWidth={2.5} strokeLinejoin="round"/><polygon points="72,31 48,48 72,65" fill={C.body} stroke={C.stroke} strokeWidth={2.5} strokeLinejoin="round"/></>; },
  mixer: () => <><rect x={20} y={32} width={56} height={32} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={26} y={36} width={44} height={24} rx={5} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/></>,
  simple_mixer: () => <><rect x={20} y={32} width={56} height={32} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={26} y={36} width={44} height={24} rx={5} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/></>,
  splitter: () => <><rect x={26} y={14} width={14} height={68} rx={4} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/></>,
  flash_drum: () => { const bx=22,by=8,bw=44,bh=128,bcx=44; return <><path d={`M${bx},${by+16} Q${bx},${by} ${bcx},${by} Q${bx+bw},${by} ${bx+bw},${by+16} L${bx+bw},${by+bh-16} Q${bx+bw},${by+bh} ${bcx},${by+bh} Q${bx},${by+bh} ${bx},${by+bh-16} Z`} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={30} y={20} width={28} height={104} rx={6} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/></>; },
  distillation_column: () => <><rect x={20} y={4} width={56} height={136} rx={28} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={26} y={14} width={44} height={112} rx={20} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/></>,
  membrane_separator: () => <><rect x={10} y={6} width={76} height={84} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={18} y={14} width={60} height={68} rx={4} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/><line x1={48} y1={14} x2={48} y2={82} stroke={C.stroke} strokeWidth={2} strokeDasharray="4 3" opacity={.5}/></>,
  reactor_adiabatic: () => <><rect x={10} y={15} width={76} height={66} rx={14} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={47} r={28} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/>{[12,20,28,36].map(x=><line key={x} x1={x} y1={69} x2={x+6} y2={75} stroke="#fbbf24" strokeWidth={1.5} opacity={.12}/>)}</>,
  combustion_chamber: () => <><rect x={10} y={15} width={76} height={66} rx={14} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={47} r={28} fill="#1a0800" stroke={C.vpRim} strokeWidth={2}/>{[12,20,28,36].map(x=><line key={x} x1={x} y1={69} x2={x+6} y2={75} stroke="#fbbf24" strokeWidth={1.5} opacity={.12}/>)}</>,
  reactor_jacketed: () => <><rect x={4} y={0} width={88} height={76} rx={18} fill="#b91c1c" opacity={.08} stroke="#7f1d1d" strokeWidth={2} strokeDasharray="6 3"/><rect x={12} y={4} width={72} height={68} rx={14} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={38} r={26} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/><path d="M8,102 L14,102 L17,96 L21,108 L25,96 L29,108 L33,96 L37,108 L41,96 L45,108 L49,96 L53,108 L57,96 L61,108 L65,96 L69,108 L73,96 L77,108 L80,102 L88,102" fill="none" stroke="#fca5a5" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" opacity={.4}/></>,
  reactor_cooled: () => <><rect x={-2} y={-2} width={100} height={148} rx={4} fill="none" stroke="#1e3a5f" strokeWidth={1} strokeDasharray="4 3" opacity={.12}/><rect x={12} y={4} width={72} height={68} rx={14} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><circle cx={48} cy={38} r={26} fill={C.vp} stroke={C.vpRim} strokeWidth={2}/><path d="M0,120 L14,120 L14,100 L22,100 L22,120 L30,120 L30,100 L38,100 L38,120 L46,120 L46,100 L54,100 L54,120 L62,120 L62,100 L70,100 L70,120 L78,120 L78,100 L86,100 L86,120 L96,120" fill="none" stroke="#67e8f9" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={.6}/></>,
  reactor_electrochemical: () => <><rect x={-2} y={-2} width={100} height={148} rx={4} fill="none" stroke="#1e3a5f" strokeWidth={1} strokeDasharray="4 3" opacity={.12}/><rect x={14} y={8} width={68} height={128} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={22} y={18} width={52} height={108} rx={5} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/></>,
  fuel_cell: () => <><rect x={-2} y={-2} width={100} height={148} rx={4} fill="none" stroke="#1e3a5f" strokeWidth={1} strokeDasharray="4 3" opacity={.12}/><rect x={14} y={6} width={68} height={74} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={22} y={14} width={52} height={58} rx={5} fill={C.vp} stroke={C.vpRim} strokeWidth={1.5}/>{[20,30,40,50,60].map(y=><rect key={y} x={26} y={y} width={44} height={6} rx={1} fill="#fca5a5" opacity={.1}/>)}<path d="M0,120 L14,120 L14,100 L22,100 L22,120 L30,120 L30,100 L38,100 L38,120 L46,120 L46,100 L54,100 L54,120 L62,120 L62,100 L70,100 L70,120 L78,120 L78,100 L86,100 L86,120 L96,120" fill="none" stroke="#67e8f9" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={.6}/></>,
  tank: () => <><path d="M18,16 Q4,16 4,48 Q4,80 18,80 L126,80 Q140,80 140,48 Q140,16 126,16 Z" fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={64} y={22} width={10} height={52} rx={4} fill="#0a1515" stroke={C.stroke} strokeWidth={1.5}/></>,
  open_tank: () => <><path d="M14,14 L14,68 Q14,82 72,82 Q130,82 130,68 L130,14" fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={20} y={4} width={104} height={18} rx={2} fill={C.vp} stroke={C.vpRim} strokeWidth={1} opacity={.5}/><rect x={92} y={20} width={10} height={52} rx={4} fill="#0a1515" stroke={C.stroke} strokeWidth={1.5}/></>,
  simple_open_tank: () => <><rect x={30} y={10} width={84} height={66} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><ellipse cx={72} cy={8} rx={42} ry={6} fill="none" stroke={C.stroke} strokeWidth={2.5}/><ellipse cx={72} cy={10} rx={38} ry={4} fill="#0a1a1a" stroke={C.stroke} strokeWidth={1} opacity={.6}/><rect x={108} y={14} width={6} height={50} rx={2} fill="#0a1515" stroke={C.stroke} strokeWidth={1.2}/></>,
  simple_tank: () => <><path d="M36,26 Q22,26 22,50 L22,100 Q22,114 48,114 Q74,114 74,100 L74,50 Q74,26 62,26 Z" fill={C.body} stroke={C.stroke} strokeWidth={2.5} strokeLinejoin="round"/><rect x={36} y={8} width={24} height={20} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2}/><polygon points="48,0 55,3 55,9 48,12 41,9 41,3" fill="#374151" stroke="#6b7280" strokeWidth={1.5}/><rect x={54} y={52} width={6} height={44} rx={2} fill="#0a1515" stroke={C.stroke} strokeWidth={1.2}/><circle cx={56} cy={34} r={5} fill="#1f2937" stroke="#4b5563" strokeWidth={1.5}/></>,
  cooled_tank: () => <><rect x={-2} y={-2} width={100} height={148} rx={4} fill="none" stroke="#1e3a5f" strokeWidth={1} strokeDasharray="4 3" opacity={.15}/><path d="M36,26 Q22,26 22,50 L22,96 Q22,110 48,110 Q74,110 74,96 L74,50 Q74,26 62,26 Z" fill={C.body} stroke={C.stroke} strokeWidth={2.5} strokeLinejoin="round"/><rect x={36} y={8} width={24} height={20} rx={8} fill={C.body} stroke={C.stroke} strokeWidth={2}/><polygon points="48,0 55,3 55,9 48,12 41,9 41,3" fill="#374151" stroke="#6b7280" strokeWidth={1.5}/><rect x={54} y={52} width={6} height={36} rx={2} fill="#0a1515" stroke={C.stroke} strokeWidth={1.2}/><circle cx={56} cy={34} r={5} fill="#1f2937" stroke="#4b5563" strokeWidth={1.5}/><path d="M2,142 L10,142 L10,130 L18,130 L18,142 L30,142 L30,130 L42,130 L42,142 L54,142 L54,130 L66,130 L66,142 L78,142 L78,130 L88,130 L88,142 L94,142" fill="none" stroke="#67e8f9" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={.6}/></>,
  food_storage: () => <><rect x={-2} y={-2} width={100} height={196} rx={4} fill="none" stroke="#1e3a5f" strokeWidth={1} strokeDasharray="4 3" opacity={.15}/><rect x={8} y={4} width={80} height={172} rx={5} fill={C.body} stroke={C.stroke} strokeWidth={2.5}/><rect x={9} y={10} width={4} height={160} rx={2} fill={C.stroke} opacity={.25}/><rect x={83} y={10} width={4} height={160} rx={2} fill={C.stroke} opacity={.25}/><circle cx={48} cy={52} r={26} fill="#060a08" stroke="#555" strokeWidth={1}/><rect x={30} y={8} width={36} height={10} rx={2.5} fill="#0a0a0a" stroke="#333" strokeWidth={.5}/><rect x={7} y={55} width={5} height={3} rx={1} fill={C.stroke} opacity={.7}/><rect x={7} y={120} width={5} height={3} rx={1} fill={C.stroke} opacity={.7}/><rect x={76} y={82} width={8} height={70} rx={2} fill="#0a1515" stroke={C.stroke} strokeWidth={1}/></>,
};

// CORRECTED: includes LEDs for mixer/simple_mixer/splitter/flash_drum/air_cooler + bolts for flash_drum/mixer/simple_mixer/hydrovent
const D = {"source":{"w":2,"h":2,"bolts":[[26,34],[26,62],[70,34],[70,62]],"led":[64,66],"np":[[60,30]]},"source_atm":{"w":2,"h":2,"bolts":[[50,38],[50,58]],"led":[36,74],"np":[[46,34]]},"sink":{"w":2,"h":2,"bolts":[[36,24],[60,24],[36,70],[60,70]],"led":[56,64],"np":[[52,28]]},"grid_supply":{"w":2,"h":2,"bolts":[[16,25],[80,25],[16,71],[80,71]],"led":[24,27],"np":[[68,23],[14,63]]},"solar_panel":{"w":2,"h":2,"bolts":[[12,18],[82,18],[12,74],[82,74]],"led":[76,74],"np":[[14,68]]},"wind_turbine":{"w":2,"h":2,"bolts":[[34,34],[58,34]],"led":[34,48],"np":[[56,44]]},"tank":{"w":3,"h":2,"bolts":[[42,20],[102,20],[42,76],[102,76]],"led":[96,62],"np":[[110,22]]},"open_tank":{"w":3,"h":2,"bolts":[[22,22],[122,22],[44,76],[100,76]],"led":[108,34],"np":[[108,22]]},"simple_open_tank":{"w":3,"h":2,"bolts":[],"led":[40,75],"np":[[38,60]]},"simple_tank":{"w":2,"h":3,"bolts":[],"led":[30,52],"np":[[28,36]]},"cooled_tank":{"w":2,"h":3,"bolts":[],"led":[30,50],"np":[[28,36]]},"food_storage":{"w":2,"h":4,"bolts":[],"led":[22,13],"np":[]},"reservoir":{"w":2,"h":2,"bolts":[],"led":[60,48],"np":[[44,40]]},"atmosphere":{"w":2,"h":2,"bolts":[],"np":[]},"closed_loop_source":{"w":2,"h":2,"bolts":[[26,34],[26,62],[70,34],[70,62]],"led":[64,66],"np":[[60,30]]},"restriction":{"w":2,"h":2,"bolts":[[42,20],[54,20],[42,76],[54,76]],"led":[28,28],"np":[]},"battery":{"w":2,"h":2,"bolts":[],"led":[64,68],"np":[]},"power_hub":{"w":2,"h":3,"bolts":[[16,16],[80,16],[16,128],[80,128]],"np":[]},"power_dispatcher_5":{"w":2,"h":3,"bolts":[],"np":[]},"sink_electrical":{"w":2,"h":2,"bolts":[[16,23],[80,23],[16,73],[80,73]],"led":[82,56],"np":[[68,23]]},"gas_turbine":{"w":2,"h":2,"bolts":[[20,28],[76,28],[20,68],[76,68]],"led":[28,64],"np":[[64,28]]},"valve":{"w":2,"h":2,"bolts":[],"led":[66,59],"np":[]},"pump":{"w":2,"h":2,"bolts":[[25,25],[71,25],[25,69],[71,69]],"led":[67,59],"np":[[61,25]]},"compressor":{"w":2,"h":2,"bolts":[[24,30],[72,30],[24,66],[72,66]],"led":[28,62],"np":[[36,30]]},"fan":{"w":2,"h":2,"bolts":[[20,22],[72,22],[20,70],[72,70]],"led":[24,26],"np":[]},"compressor_diaphragm":{"w":2,"h":3,"bolts":[[18,14],[78,14],[18,66],[78,66]],"led":[70,58],"np":[[64,16]]},"electric_heater":{"w":2,"h":2,"bolts":[[16,32],[80,32],[16,64],[80,64]],"led":[76,58],"np":[[66,32]]},"air_cooler":{"w":2,"h":2,"bolts":[],"led":[62,38],"np":[]},"hex":{"w":2,"h":2,"bolts":[[14,48],[82,48],[48,20],[48,76]],"led":[70,62],"np":[[68,28]]},"mixer":{"w":2,"h":2,"bolts":[[24,36],[72,60]],"led":[68,58],"np":[]},"simple_mixer":{"w":2,"h":2,"bolts":[[24,36],[72,60]],"led":[68,58],"np":[]},"splitter":{"w":2,"h":2,"bolts":[],"led":[33,74],"np":[]},"bend":{"w":2,"h":2,"bolts":[[12,14],[84,14],[12,130],[84,130]],"np":[[64,22]]},"flash_drum":{"w":2,"h":3,"bolts":[[28,18],[60,18],[28,126],[60,126]],"led":[30,46],"np":[]},"distillation_column":{"w":2,"h":3,"bolts":[],"led":[34,42],"np":[[60,14]]},"reactor_adiabatic":{"w":2,"h":2,"bolts":[[18,23],[78,23],[18,73],[78,73]],"led":[26,25],"np":[[66,23]]},"combustion_chamber":{"w":2,"h":2,"bolts":[[18,23],[78,23],[18,73],[78,73]],"led":[26,25],"np":[[66,23]]},"reactor_jacketed":{"w":2,"h":3,"bolts":[[16,8],[80,8],[16,68],[80,68]],"led":[22,14],"np":[[18,10],[16,60]]},"reactor_cooled":{"w":2,"h":3,"bolts":[[16,8],[80,8],[16,68],[80,68]],"led":[22,14],"np":[[18,10],[16,60]]},"reactor_electrochemical":{"w":2,"h":3,"bolts":[[18,14],[78,14],[18,130],[78,130]],"led":[28,26],"np":[[64,16]]},"fuel_cell":{"w":2,"h":3,"bolts":[[18,12],[78,12],[18,74],[78,74]],"led":[72,68],"np":[[64,14]]},"membrane_separator":{"w":2,"h":2,"bolts":[[14,12],[82,12],[14,84],[82,84]],"led":[72,74],"np":[[68,14]]},"hydrovent":{"w":2,"h":2,"bolts":[[32,62],[48,62]],"led":[66,40],"np":[[52,42]]}};

const CATS = [
  {l:"Sources & Sinks",ids:["source","source_atm","sink","reservoir","atmosphere","closed_loop_source","restriction","bend","hydrovent"]},
  {l:"Power",ids:["grid_supply","solar_panel","wind_turbine","battery","sink_electrical","power_hub","power_dispatcher_5"]},
  {l:"Movers & Heat",ids:["pump","compressor","fan","compressor_diaphragm","gas_turbine","electric_heater","air_cooler","hex","valve"]},
  {l:"Mixing & Separation",ids:["mixer","simple_mixer","splitter","flash_drum","distillation_column","membrane_separator"]},
  {l:"Reactors",ids:["reactor_adiabatic","combustion_chamber","reactor_jacketed","reactor_cooled","reactor_electrochemical","fuel_cell"]},
  {l:"Vessels",ids:["tank","open_tank","simple_open_tank","simple_tank","cooled_tank","food_storage"]},
];

const STORAGE_KEY = "ptis-icon-edits";
const bst = {background:'#21262d',border:'1px solid #30363d',borderRadius:4,color:'#c9d1d9',fontSize:11,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit'};

export default function App() {
  const [sel, setSel] = useState("pump");
  const [zoom, setZoom] = useState(4);
  const [drag, setDrag] = useState(null);
  const [edits, setEdits] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importText, setImportText] = useState("");
  const [toast, setToast] = useState(null);
  const svgRef = useRef(null);
  const [mouse, setMouse] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result?.value) setEdits(JSON.parse(result.value));
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => { try { await window.storage.set(STORAGE_KEY, JSON.stringify(edits)); } catch(e){} })();
  }, [edits, loaded]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const u = D[sel]; if (!u) return null;
  const pw = u.w*T, ph = u.h*T, pad = 20;
  const pos = edits[sel] || {};
  const ledPos = pos.led !== undefined ? pos.led : (u.led ? [...u.led] : null);
  const npPos = pos.np !== undefined ? pos.np : (u.np ? u.np.map(p=>[...p]) : []);
  const save = (led,np) => setEdits(p=>({...p,[sel]:{led,np}}));

  const toSvg = useCallback(e => {
    const svg = svgRef.current; if(!svg) return [0,0];
    const r = svg.getBoundingClientRect();
    return [snap((e.clientX-r.left)/zoom-pad), snap((e.clientY-r.top)/zoom-pad)];
  },[zoom]);

  const onDown = useCallback((e,type,idx=0) => {
    e.preventDefault(); e.stopPropagation();
    e.target.setPointerCapture?.(e.pointerId);
    const [mx,my]=toSvg(e);
    const orig = type==='led'?ledPos:npPos[idx];
    if(!orig) return;
    setDrag({type,idx,sx:mx,sy:my,ox:orig[0],oy:orig[1]});
  },[toSvg,ledPos,npPos]);

  const onMove = useCallback(e => {
    const [mx,my]=toSvg(e); setMouse([mx,my]);
    if(!drag) return;
    const nx=snap(drag.ox+mx-drag.sx), ny=snap(drag.oy+my-drag.sy);
    if(drag.type==='led') save([nx,ny],npPos);
    else { const nn=npPos.map((p,i)=>i===drag.idx?[nx,ny]:[...p]); save(ledPos,nn); }
  },[drag,toSvg,ledPos,npPos]);

  const code = () => {
    const l=[];
    if(ledPos) l.push(`    _rtLED(g, wx+${ledPos[0]}, wy+${ledPos[1]}, unitId);`);
    npPos.forEach(([x,y])=>l.push(`    _rtNameplate(g, wx+${x}, wy+${y}, unitId);`));
    return l.join('\n');
  };

  const exportAll = () => {
    const out = {};
    for (const id of Object.keys(D)) {
      const e = edits[id], d = D[id];
      const led = e?.led !== undefined ? e.led : (d.led || null);
      const np = e?.np !== undefined ? e.np : (d.np || []);
      if (led || np.length) { out[id] = {}; if(led) out[id].led=led; if(np.length) out[id].np=np; }
    }
    return JSON.stringify(out);
  };

  const exportEdited = () => JSON.stringify(edits);
  const editCount = Object.keys(edits).length;
  const ShapeFn = S[sel];

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:"'JetBrains Mono','Fira Code',monospace",background:C.bg,color:'#c9d1d9',overflow:'hidden',position:'relative'}}>
      {toast && <div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',background:'#238636',color:'#fff',padding:'6px 16px',borderRadius:6,fontSize:12,zIndex:99,pointerEvents:'none'}}>{toast}</div>}
      <div style={{width:200,borderRight:'1px solid #21262d',overflowY:'auto',flexShrink:0,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'10px 12px',fontSize:11,color:'#58a6ff',fontWeight:700,letterSpacing:1}}>PTIS ICON EDITOR</div>
        <div style={{flex:1,overflowY:'auto'}}>
          {CATS.map(cat=><div key={cat.l}>
            <div style={{padding:'5px 12px',fontSize:9,color:'#484f58',textTransform:'uppercase',letterSpacing:1,marginTop:6}}>{cat.l}</div>
            {cat.ids.map(id=><div key={id} onClick={()=>setSel(id)} style={{
              padding:'3px 12px',cursor:'pointer',fontSize:11,
              background:id===sel?'#1f2937':'transparent',borderLeft:id===sel?'2px solid #58a6ff':'2px solid transparent',
              color:id===sel?'#e6edf3':'#8b949e',display:'flex',gap:4,alignItems:'center'}}>
              <span style={{flex:1}}>{id}</span>
              {edits[id]&&<span style={{color:'#f97316',fontSize:9}}>✎</span>}
              <span style={{fontSize:8,color:'#484f58'}}>{D[id]?.w}×{D[id]?.h}</span>
            </div>)}
          </div>)}
        </div>
        <div style={{padding:'8px 10px',borderTop:'1px solid #21262d',display:'flex',flexDirection:'column',gap:4}}>
          <div style={{fontSize:9,color:'#484f58'}}>{editCount} unit{editCount!==1?'s':''} edited · auto-saved</div>
          <button onClick={()=>{setShowExport(!showExport);setImportText("");}} style={{...bst,width:'100%',textAlign:'center',background:showExport?'#1f2937':'#21262d'}}>
            {showExport ? 'Close Panel' : 'Export / Import'}
          </button>
          {edits[sel] && <button onClick={()=>{const e={...edits};delete e[sel];setEdits(e);flash('Reset '+sel);}} style={{...bst,width:'100%',textAlign:'center',borderColor:'#da3633'}}>Reset {sel}</button>}
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 14px',borderBottom:'1px solid #21262d',background:'#161b22',flexShrink:0,flexWrap:'wrap'}}>
          <span style={{fontSize:14,fontWeight:700,color:'#e6edf3'}}>{sel}</span>
          <span style={{fontSize:10,color:'#484f58'}}>{u.w}×{u.h} · {pw}×{ph}px</span>
          {mouse&&<span style={{fontSize:10,color:'#6e7681',fontVariantNumeric:'tabular-nums'}}>x:{mouse[0]} y:{mouse[1]}</span>}
          <div style={{flex:1}}/>
          {!ledPos?<button onClick={()=>save([pw/2,ph/2],npPos)} style={bst}>+ LED</button>:<button onClick={()=>save(null,npPos)} style={{...bst,borderColor:'#da3633'}}>− LED</button>}
          <button onClick={()=>save(ledPos,[...npPos,[pw/2-10,10]])} style={bst}>+ Nameplate</button>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:9,color:'#484f58'}}>Zoom</span>
            <input type="range" min={2} max={8} step={.5} value={zoom} onChange={e=>setZoom(+e.target.value)} style={{width:70,accentColor:'#58a6ff'}}/>
            <span style={{fontSize:10,color:'#6e7681',width:20}}>{zoom}×</span>
          </div>
        </div>
        {showExport && (
          <div style={{borderBottom:'1px solid #21262d',background:'#161b22',padding:'10px 14px',display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:300}}>
              <div style={{fontSize:10,color:'#58a6ff',marginBottom:4,fontWeight:700}}>EXPORT — all positions (paste to Claude)</div>
              <textarea readOnly value={exportAll()} style={{width:'100%',height:60,background:'#0d1117',border:'1px solid #30363d',borderRadius:4,color:'#c9d1d9',fontSize:10,fontFamily:'inherit',padding:6,resize:'vertical'}}/>
              <div style={{display:'flex',gap:6,marginTop:4}}>
                <button onClick={()=>{navigator.clipboard?.writeText(exportAll());flash('Copied all positions!');}} style={bst}>Copy All</button>
                <button onClick={()=>{navigator.clipboard?.writeText(exportEdited());flash('Copied edits only!');}} style={bst}>Copy Edits Only ({editCount})</button>
              </div>
            </div>
            <div style={{flex:1,minWidth:300}}>
              <div style={{fontSize:10,color:'#f97316',marginBottom:4,fontWeight:700}}>IMPORT — paste JSON to restore</div>
              <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder='Paste exported JSON here...' style={{width:'100%',height:60,background:'#0d1117',border:'1px solid #30363d',borderRadius:4,color:'#c9d1d9',fontSize:10,fontFamily:'inherit',padding:6,resize:'vertical'}}/>
              <button onClick={()=>{
                try { const d=JSON.parse(importText); setEdits(d); flash(`Imported ${Object.keys(d).length} units!`); setImportText(""); }
                catch(e) { flash('Invalid JSON!'); }
              }} style={{...bst,marginTop:4}}>Import</button>
            </div>
          </div>
        )}
        <div style={{flex:1,overflow:'auto',display:'flex',justifyContent:'center',alignItems:'flex-start',padding:16}}>
          <svg ref={svgRef} width={(pw+pad*2)*zoom} height={(ph+pad*2)*zoom}
            viewBox={`${-pad} ${-pad} ${pw+pad*2} ${ph+pad*2}`}
            style={{background:C.bg,border:'1px solid #21262d',borderRadius:4,cursor:drag?'grabbing':'crosshair'}}
            onPointerMove={onMove} onPointerUp={()=>setDrag(null)}>
            {Array.from({length:u.w+1},(_,i)=><line key={`v${i}`} x1={i*T} y1={0} x2={i*T} y2={ph} stroke="#1e2430" strokeWidth={.5} strokeDasharray="2 4"/>)}
            {Array.from({length:u.h+1},(_,i)=><line key={`h${i}`} x1={0} y1={i*T} x2={pw} y2={i*T} stroke="#1e2430" strokeWidth={.5} strokeDasharray="2 4"/>)}
            {ShapeFn?<ShapeFn/>:<rect x={4} y={4} width={pw-8} height={ph-8} rx={6} fill={C.body} stroke={C.stroke} strokeWidth={2}/>}
            {(u.bolts||[]).map(([bx,by],i)=><circle key={`b${i}`} cx={bx} cy={by} r={2.5} fill={C.bolt} stroke={C.bs} strokeWidth={1.2}/>)}
            {npPos.map(([nx,ny],idx)=>{const lg=pw>192||ph>192;const nw=lg?10:8,nh=lg?5:4;return(
              <g key={`np${idx}`}><rect x={nx-3} y={ny-3} width={nw+6} height={nh+6} fill="transparent" style={{cursor:'grab'}} onPointerDown={e=>onDown(e,'np',idx)}/>
              <rect x={nx} y={ny} width={nw} height={nh} rx={1} fill="#4b5563" opacity={.8} stroke="#58a6ff" strokeWidth={.8}/>
              <g onClick={()=>{const nn=npPos.filter((_,j)=>j!==idx);save(ledPos,nn);}} style={{cursor:'pointer'}}><circle cx={nx+nw+5} cy={ny-1} r={3.5} fill="#21262d" stroke="#da3633" strokeWidth={.6}/><text x={nx+nw+5} y={ny+1.2} textAnchor="middle" fontSize={5} fill="#da3633" fontWeight="bold">×</text></g></g>
            );})}
            {ledPos&&<g><circle cx={ledPos[0]} cy={ledPos[1]} r={8} fill="transparent" style={{cursor:'grab'}} onPointerDown={e=>onDown(e,'led')}/><circle cx={ledPos[0]} cy={ledPos[1]} r={2.5} fill="#22c55e" opacity={.9} stroke="#58a6ff" strokeWidth={.8}/></g>}
            <rect x={0} y={0} width={pw} height={ph} fill="none" stroke="#30363d" strokeWidth={.8}/>
          </svg>
        </div>
        <div style={{borderTop:'1px solid #21262d',background:'#161b22',padding:'8px 14px',flexShrink:0,display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{minWidth:180}}>
            <div style={{fontSize:9,color:'#484f58',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Positions</div>
            {ledPos&&<div style={{fontSize:11,color:'#7ee787'}}>LED: wx+{ledPos[0]}, wy+{ledPos[1]}</div>}
            {npPos.map(([x,y],i)=><div key={i} style={{fontSize:11,color:'#8b949e'}}>NP{npPos.length>1?` ${i+1}`:''}: wx+{x}, wy+{y}</div>)}
            {!ledPos&&npPos.length===0&&<div style={{fontSize:10,color:'#484f58',fontStyle:'italic'}}>No elements</div>}
          </div>
          <div style={{flex:1,minWidth:280}}>
            <div style={{fontSize:9,color:'#484f58',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>Code</div>
            <pre style={{background:'#0d1117',border:'1px solid #21262d',borderRadius:4,padding:'6px 10px',fontSize:11,color:'#c9d1d9',margin:0,whiteSpace:'pre-wrap',maxHeight:70,overflowY:'auto'}}>{code()||'// No elements'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
