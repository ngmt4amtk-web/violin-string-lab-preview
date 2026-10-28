// A teaching model of steady bowed-string motion; never a measured instrument.
export const STRINGS = {
  G: { midi: 55, tension: 48, color: '#9a6944' },
  D: { midi: 62, tension: 45, color: '#a47b32' },
  A: { midi: 69, tension: 55, color: '#387c78' },
  E: { midi: 76, tension: 70, color: '#6778a8' },
};
export const DEFAULT = Object.freeze({string:'A', semitone:0, distance:32, speed:10, force:35, length:328, tension:55, friction:.52, resistance:10, fingerLoss:2, bodyLoss:1, hairTension:60, lock:'mm',keepPitch:false});
// Bow hair as a taut thread of fixed length; it does not enter the Schelleng bounds.
export const HAIR_LENGTH=640;
export const GF = .00980665;
const clamp = (x,a,b) => Math.min(b, Math.max(a,x));
export function sanitize(input={}) {
  const s = {...DEFAULT};
  if (Object.hasOwn(STRINGS,input.string)) s.string=input.string;
  const fields={semitone:[0,24],distance:[2,65],speed:[0,60],force:[0,1000],length:[300,350],tension:[25,100],friction:[.15,1.2],resistance:[2,40],fingerLoss:[1,4],bodyLoss:[.5,5],hairTension:[30,90]};
  for(const [k,[a,b]] of Object.entries(fields)) if(input[k]!==null && input[k]!=='' && Number.isFinite(Number(input[k]))) s[k]=clamp(Number(input[k]),a,b);
  s.semitone=Math.round(s.semitone);
  s.distance=Math.min(s.distance,s.length*2**(-s.semitone/12)*.45);
  s.lock=input.lock==='ratio'?'ratio':'mm';
  s.keepPitch=input.keepPitch===true||input.keepPitch==='true';
  return s;
}
export function calculate(input) {
  const s=sanitize(input), openFrequency=440*2**((STRINGS[s.string].midi-69)/12);
  const frequency=openFrequency*2**(s.semitone/12), length=s.length/1000*2**(-s.semitone/12);
  const beta=(s.distance/1000)/length, z=s.tension/(2*(s.length/1000)*openFrequency), speed=s.speed/100;
  const loss=s.bodyLoss*(s.semitone===0?1:s.fingerLoss), effectiveR=s.resistance/loss;
  const minimum=z*z*speed/(2*effectiveR*beta*beta*s.friction)/GF;
  const maximum=2*z*speed/(beta*s.friction)/GF;
  const state=s.speed===0?'stopped':minimum>=maximum?'none':s.force<minimum?'light':s.force>maximum?'heavy':'stable';
  const amplitude=s.speed===0?0:speed/(8*frequency*beta); // ideal transverse peak amplitude, m
  const sink=f=>f*GF*(HAIR_LENGTH/1000)/(4*s.hairTension)*1000; // mid-bow hair deflection, mm
  return {...s,openFrequency,frequency,vibratingLength:length*1000,beta,z,loss,effectiveR,minimum,maximum,state,amplitude:amplitude*1000,ratio:s.speed===0?0:maximum/minimum,stick:1-beta,slip:beta,hairSink:sink(s.force),hairSinkMin:sink(minimum),hairSinkMax:sink(maximum)};
}
export function changePitch(input,semitone) {
  const before=calculate(input), s={...before,semitone};
  if(s.lock==='ratio') s.distance=before.beta*s.length*2**(-semitone/12);
  return sanitize(s);
}
export function changeString(input,string) {
  if(!Object.hasOwn(STRINGS,string))return sanitize(input);
  const s=sanitize(input),semitone=s.keepPitch?STRINGS[s.string].midi+s.semitone-STRINGS[string].midi:s.semitone;
  if(semitone<0||semitone>24)return s;
  return {...changePitch(s,semitone),string,tension:STRINGS[string].tension};
}
export function noteName(input) {
  const midi=STRINGS[input.string].midi+input.semitone, names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  return `${names[midi%12]}${Math.floor(midi/12)-1}`;
}
export function encode(input) { return new URLSearchParams(Object.entries({...sanitize(input),model:'schelleng-v1'}).map(([k,v])=>[k,typeof v==='number'?String(Math.round(v*100000)/100000):v])).toString(); }
export function decode(hash) { return sanitize(Object.fromEntries(new URLSearchParams(hash.replace(/^#/,'')))); }


// Relative bridge-force magnitude in the ideal motion; not measured loudness.
export function loudness(input) {
  const m=calculate(input),reference=calculate(DEFAULT);
  return 100*(m.z*m.speed/m.beta)/(reference.z*reference.speed/reference.beta);
}
