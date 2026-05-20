"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/common/Button";
import { AppModals, type ModalKind } from "@/components/domain/AppModals";

export function EmptyHomeScreen() {
  const [modal, setModal] = useState<ModalKind>(null);

  return (
    <AppShell activeTab="home">
      <section className="empty-state">
        <Image
          alt="야구공 마스코트"
          className="empty-mascot"
          height={220}
          priority
          src="/assets/mascot-bat.png"
          width={220}
        />
        <h1>
          첫 직관을 등록하고
          <br />내 승률을 만들어보세요
        </h1>
        <p>경기장에 다녀온 날을 기록하면 승률과 추억이 자동으로 쌓여요.</p>
        <Button onClick={() => setModal("attendance")}>
          <Plus size={18} />
          직관 등록
        </Button>
        <Link className="empty-link" href="/" prefetch>
          샘플 홈 둘러보기
        </Link>
      </section>
      <AppModals open={modal} setOpen={setModal} />
    </AppShell>
  );
}
