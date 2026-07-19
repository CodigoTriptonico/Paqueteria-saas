import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const shell = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
const frame = readFileSync(join(process.cwd(), "src/components/app-frame.tsx"), "utf8");
const commandCenter = readFileSync(join(process.cwd(), "src/components/business/business-command-center.tsx"), "utf8");

describe("business navigation", () => {
  it("keeps Mi agencia first and Agencias a mi cargo last", () => {
    const agencySection = shell.indexOf('{ id: "agencies", label: "Agencias" }');
    const ownAgencyItem = shell.indexOf('{ label: "Mi agencia", href: "/agencia", icon: Building2, section: "agencies" }');
    const requestsItem = shell.indexOf('{ label: "Solicitudes", href: "/solicitudes", icon: ClipboardList, section: "agencies" }');
    const administrationItem = shell.indexOf('{ label: "Vendedores y agencias", href: "/agencias", icon: Building2, section: "agencies" }');
    const managedAgenciesItem = shell.indexOf('{ label: "Agencias a mi cargo", href: "/captacion", icon: Users, section: "agencies" }');

    assert.ok(agencySection >= 0);
    assert.ok(ownAgencyItem > agencySection);
    assert.ok(requestsItem > ownAgencyItem);
    assert.ok(administrationItem > requestsItem);
    assert.ok(managedAgenciesItem > administrationItem);
    assert.equal(shell.includes('label: "Mis agencias"'), false);
    assert.match(frame, /pathname\.startsWith\("\/captacion"\)[\s\S]*return "Agencias a mi cargo"/);
  });

  it("keeps sidebar routes out of Mi agencia shortcuts", () => {
    assert.match(shell, /\{ label: "Nueva venta", href: "\/venta"/);
    assert.match(shell, /\{ label: "Solicitudes", href: "\/solicitudes"/);
    assert.doesNotMatch(commandCenter, /<Link className=\{primaryButtonClass\} href="\/venta">Crear venta<\/Link>/);
    assert.doesNotMatch(commandCenter, /href="\/solicitudes">Nueva solicitud/);
  });
});
