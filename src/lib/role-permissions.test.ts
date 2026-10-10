import { it } from "node:test";
import { strict as assert } from "node:assert";
import { rolePermissions } from "./role-permissions";
it("supervisor is read-only and can export reports", () => {
 assert.deepEqual(rolePermissions(["supervisor"]), {isSupervisor:true,isAdmin:false,isOperator:false,canEntry:false,canExportReports:true});
});
it("supervisor cannot gain write access through additional roles", () => {
 assert.equal(rolePermissions(["supervisor","admin","operator"]).canEntry,false);
 assert.equal(rolePermissions(["supervisor","admin"]).isAdmin,false);
});
it("admin retains write access", () => { assert.equal(rolePermissions(["admin"]).canEntry,true); });
