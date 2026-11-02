# glb_tris.py <in.glb> <out.npz> [--list] - a GLB's triangles in world space (node matrices / TRS composed) and one node path per
# triangle: the reference half of tools/ref_match (tools/REF_MATCH.md). numpy only; run with python3 -I.
import struct,json,sys
import numpy as np
d=open(sys.argv[1],'rb').read()
cl,_=struct.unpack('<I4s',d[12:20]); J=json.loads(d[20:20+cl]); off=20+cl
bl,_=struct.unpack('<I4s',d[off:off+8]); BIN=d[off+8:off+8+bl]
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(i):
    a=J['accessors'][i]; bv=J['bufferViews'][a['bufferView']]; o=bv.get('byteOffset',0)+a.get('byteOffset',0)
    dt=np.dtype(CT[a['componentType']]); n=NC[a['type']]; st=bv.get('byteStride',0)
    if st and st!=dt.itemsize*n:
        raw=np.frombuffer(BIN,dtype=np.uint8,count=st*a['count'],offset=o).reshape(a['count'],st)[:,:dt.itemsize*n]
        return np.frombuffer(raw.tobytes(),dtype=dt).reshape(a['count'],n)
    return np.frombuffer(BIN,dtype=dt,count=a['count']*n,offset=o).reshape(a['count'],n)
def qm(q):
    x,y,z,w=q; return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def local(n):
    if 'matrix' in n: return np.array(n['matrix'],dtype=float).reshape(4,4).T
    M=np.eye(4); T=n.get('translation',[0,0,0]); R=n.get('rotation',[0,0,0,1]); S=n.get('scale',[1,1,1])
    M[:3,:3]=qm(R)@np.diag(S); M[:3,3]=T; return M
tris=[]; names=[]
def walk(i,P,path):
    n=J['nodes'][i]; M=P@local(n); nm=n.get('name','')
    if 'mesh' in n:
        for pr in J['meshes'][n['mesh']]['primitives']:
            if pr.get('mode',4)!=4: continue
            V=acc(pr['attributes']['POSITION']).astype(float); V=(M@np.c_[V,np.ones(len(V))].T).T[:,:3]
            I=acc(pr['indices']).ravel() if 'indices' in pr else np.arange(len(V))
            T=V[I.reshape(-1,3)]; tris.append(T); names.extend([path+'/'+nm]*len(T))
    for c in n.get('children',[]): walk(c,M,path+'/'+nm)
for r in J['scenes'][J.get('scene',0)]['nodes']: walk(r,np.eye(4),'')
T=np.concatenate(tris); np.savez(sys.argv[2],T=T,names=np.array(names))
if '--list' in sys.argv:
    # every mesh node's box, the GLB's own units: how a new reference's parts are found for its refs/<key>.json
    N=np.array(names); seen=[]
    for n in N:
        if n not in seen: seen.append(n)
    for n in seen:
        P=T[N==n].reshape(-1,3); lo=P.min(0); hi=P.max(0)
        print('%-60s tris %5d  x %8.1f %8.1f  y %8.1f %8.1f  z %8.1f %8.1f'%(n[-60:],(N==n).sum(),lo[0],hi[0],lo[1],hi[1],lo[2],hi[2]))
lo=T.reshape(-1,3).min(0); hi=T.reshape(-1,3).max(0); print('tris',len(T),'bbox lo',lo.round(3),'hi',hi.round(3),'size',(hi-lo).round(3))
