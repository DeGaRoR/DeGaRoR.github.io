
/opt/node22/bin/node:     file format elf64-x86-64


Disassembly of section .text:

00000000029e8610 <_ZN2v84base7ieee7543powEdd>:
 29e8610:	movq   %xmm1,%rdx
 29e8615:	movq   %xmm1,%rsi
 29e861a:	shr    $0x20,%rdx
 29e861e:	mov    %edx,%eax
 29e8620:	and    $0x7fffffff,%eax
 29e8625:	mov    %eax,%ecx
 29e8627:	or     %esi,%ecx
 29e8629:	je     29e86e8 <_ZN2v84base7ieee7543powEdd+0xd8>
 29e862f:	movq   %xmm0,%r8
 29e8634:	movq   %xmm0,%rdi
 29e8639:	shr    $0x20,%r8
 29e863d:	mov    %r8d,%r9d
 29e8640:	and    $0x7fffffff,%r9d
 29e8647:	cmp    $0x7ff00000,%r9d
 29e864e:	jg     29e86d8 <_ZN2v84base7ieee7543powEdd+0xc8>
 29e8654:	sete   %r10b
 29e8658:	test   %edi,%edi
 29e865a:	setne  %cl
 29e865d:	test   %cl,%r10b
 29e8660:	jne    29e86d8 <_ZN2v84base7ieee7543powEdd+0xc8>
 29e8662:	cmp    $0x7ff00000,%eax
 29e8667:	jg     29e86d8 <_ZN2v84base7ieee7543powEdd+0xc8>
 29e8669:	jne    29e866f <_ZN2v84base7ieee7543powEdd+0x5f>
 29e866b:	test   %esi,%esi
 29e866d:	jne    29e86d8 <_ZN2v84base7ieee7543powEdd+0xc8>
 29e866f:	push   %rbp
 29e8670:	xor    %r10d,%r10d
 29e8673:	mov    %rsp,%rbp
 29e8676:	push   %rbx
 29e8677:	sub    $0x18,%rsp
 29e867b:	test   %r8d,%r8d
 29e867e:	js     29e8788 <_ZN2v84base7ieee7543powEdd+0x178>
 29e8684:	test   %esi,%esi
