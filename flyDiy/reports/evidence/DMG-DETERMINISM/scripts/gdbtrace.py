import gdb, struct
gdb.execute('set pagination off')
gdb.execute('set confirm off')
gdb.execute('break v8::base::ieee754::pow')
gdb.execute('run')
out = open('/tmp/claude-0/s/trace.txt', 'w')
def xmm(i):
    v = gdb.parse_and_eval('$xmm%d.v2_int64[0]' % i)
    return struct.unpack('<d', struct.pack('<q', int(v)))[0]
for step in range(2000):
    frame = gdb.selected_frame()
    pc = int(frame.pc())
    insn = gdb.execute('x/i $pc', to_string=True).strip()
    regs = ' '.join('%r' % xmm(i) for i in range(16))
    out.write(insn + ' || ' + regs + '\n')
    if 'ret' in insn.split(':')[-1].split()[:1]:
        break
    gdb.execute('stepi', to_string=True)
out.close()
gdb.execute('kill')
