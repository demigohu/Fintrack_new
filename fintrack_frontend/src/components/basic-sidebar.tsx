"use client"

import * as React from "react"
import { TrendingUp, PieChart, ArrowDownToLine, Home, GalleryVerticalEnd, History, Send, CalendarCheck, Target, Zap } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
  SidebarGroup,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleTrigger } from "./ui/collapsible";
import Link from "next/link";
import { DropdownMenu } from "./ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Trade",
    url: "/trade",
    icon: TrendingUp,
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: PieChart,
  },
  {
    title: "Deposits",
    url: "/deposits",
    icon: ArrowDownToLine,
  },
  {
    title: "Budgets",
    url: "/budgets",
    icon: CalendarCheck,
  },
  {
    title: "Goals",
    url: "/goals",
    icon: Target,
  },
  {
    title: "Bridge",
    url: "/bridge",
    icon: Zap,
  },
  {
    title: "Transfer",
    url: "/transfer",
    icon: Send,
  },
  {
    title: "Transactions",
    url: "/transactions",
    icon: History,
  },
]

export function BasicSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Sidebar className="bg-sidebar/95 backdrop-blur-xl border-r border-purple-500/20" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <SidebarMenuButton
                onClick={toggleSidebar}
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-xl font-heading font-bold text-glow bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">FinTrack</span>
                  {/* <span className="truncate text-xs">{activeTeam.plan}</span> */}
                </div>
                {/* <ChevronsUpDown className="ml-auto" /> */}
              </SidebarMenuButton>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {/* <SidebarGroupLabel>Platform</SidebarGroupLabel> */}
          <SidebarMenu>
            {navItems.map((item) => (
              <Collapsible
                key={item.title}
                asChild
                // defaultOpen={item.isActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <Link href={item.url}
                      key={item.url}>
                      <SidebarMenuButton className='cursor-pointer' tooltip={item.title}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        {/* <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" /> */}
                      </SidebarMenuButton>
                    </Link>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">Theme</span>
          <ThemeToggle />
        </div>
      </SidebarFooter>
      {/* <SidebarRail /> */}
    </Sidebar>
  )
}
