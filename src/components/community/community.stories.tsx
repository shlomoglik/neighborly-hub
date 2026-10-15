import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { VisibilitySelector, type Visibility } from "./VisibilitySelector";
import { HouseholdRow } from "./HouseholdRow";
import { ApartmentMap, type ApartmentTileModel } from "./ApartmentMap";
import { JoinRequestCard } from "./JoinRequestCard";
import { BirthdayCard } from "./BirthdayCard";
import { SystemFeedback } from "./SystemFeedback";
import { StatusBadge, type ResidentStatus } from "./StatusBadge";
function PrivacyDemo() { const [value,setValue] = useState<Visibility>("building"); return <VisibilitySelector value={value} onChange={setValue}/>; }
function MapDemo() { const [selectedId,setSelectedId] = useState<string>(); const apartments: ApartmentTileModel[] = Array.from({length:24},(_,i)=>({id:String(i+1),number:String(i+1),floor:Math.floor(i/4)+1,status:i%7===0?"pending":i%5===0?"vacant":"occupied",label:i%5===0?undefined:`משפחה ${i+1}`})); return <ApartmentMap apartments={apartments} selectedId={selectedId} onSelect={setSelectedId}/>; }
function RequestDemo() { const [status,setStatus] = useState<ResidentStatus>("pending"); return <div className="space-y-3">{status === "pending" ? <JoinRequestCard request={{id:"1",familyName:"משפחת שפירא",building:"2",apartment:"18",conflictWith:"משפחת לוי"}} onApprove={()=>setStatus("approved")} onReject={()=>setStatus("rejected")}/> : <StatusBadge status={status}/>}</div>; }
const meta = { title:"Features/Community/Building Blocks", component: PrivacyDemo, tags:["autodocs"] } satisfies Meta<typeof PrivacyDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Privacy: Story = {};
export const BuildingMap: Story = { render: () => <MapDemo/> };
export const JoinRequest: Story = { render: () => <RequestDemo/> };
export const Household: Story = { render: () => <HouseholdRow household={{id:"1",familyName:"משפחת כהן",building:"1",apartment:"12",isMine:true,phone:"0501234567",phoneVisible:true,birthdayLabel:"מחר"}}/> };
export const HiddenContact: Story = { render: () => <HouseholdRow household={{id:"2",familyName:"משפחת אברהם",building:"1",apartment:"3",phoneVisible:false}}/> };
export const Birthday: Story = { render: () => <BirthdayCard name="נועה מזרחי" when="מחר" age={9}/> };
export const Empty: Story = { render: () => <SystemFeedback kind="empty"/> };
export const Error: Story = { render: () => <SystemFeedback kind="error" onRetry={()=>{}}/> };
export const Offline: Story = { render: () => <SystemFeedback kind="offline"/> };
export const Private: Story = { render: () => <SystemFeedback kind="private"/> };
