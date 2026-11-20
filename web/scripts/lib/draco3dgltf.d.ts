// draco3dgltf ไม่มี type มาให้ — ใช้กับ @gltf-transform เท่านั้น (scripts/)
declare module 'draco3dgltf' {
  const draco3d: {
    createEncoderModule(): Promise<unknown>;
    createDecoderModule(): Promise<unknown>;
  };
  export default draco3d;
}
